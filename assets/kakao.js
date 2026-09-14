/* KeyMiles — 카카오톡 대화 내보내기 파서
 * 안드로이드 / iOS / 윈도우 PC / macOS(CSV) 네 가지 내보내기 형식을 읽어
 * { 화자, 시각, 본문 } 목록으로 바꾼다. DOM에 손대지 않는 순수 함수 모음.
 *
 * 설계 원칙
 *  - 절대 throw 하지 않는다. 카톡 파일이 아니면 { ok:false } 를 돌려준다.
 *  - 포맷을 먼저 판별하고, 그 다음부터는 그 포맷의 정규식만 줄마다 돌린다 (O(n)).
 *  - 어떤 패턴에도 안 맞는 줄은 직전 메시지 본문에 "\n" 으로 이어 붙인다 (여러 줄 메시지).
 */
(function (root) {
  "use strict";

  /* ------------------------------------------------------------- 상수 */

  var FORMATS = {
    android: "안드로이드",
    ios: "iOS(아이폰·아이패드)",
    windows: "윈도우 PC",
    macos: "macOS(CSV)"
  };

  var MAX_BYTES = 50 * 1024 * 1024;      // 50MB 초과 파일은 거절
  var BAD_RATIO = 0.002;                 // U+FFFD 0.2% 넘으면 euc-kr 재시도
  var HEAD_BYTES = 65536;                // 포맷 판별에 쓰는 앞부분 길이
  var HEAD_LINES = 500;                  // 포맷 판별에 쓰는 줄 수

  // 분석해도 의미 없는 자동 생성 본문 (걸러내고 filteredCount 만 올린다)
  var DROP_EXACT = {
    "사진": 1,
    "동영상": 1,
    "이모티콘": 1,
    "음성메시지": 1,
    "삭제된 메시지입니다.": 1,
    "보이스룸이 종료되었습니다.": 1
  };
  var RE_PHOTOS = /^사진 \d+장$/;
  var RE_URL = /https?:\/\/\S+/g;
  var RE_TRAIL = /[ \t]+$/gm;
  var RE_BOM = /^﻿/;

  var MONTHS = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
  };

  /* 안드로이드: "2024년 1월 3일 오전 9:05, 홍길동 : 안녕" */
  var RE_A_MSG    = /^(\d{4})년 (\d{1,2})월 (\d{1,2})일 (오전|오후) (\d{1,2}):(\d{1,2}), (.*?) : ([\s\S]*)$/;
  /* 같은 앞부분이지만 " : " 가 없는 줄 = 시스템 알림 (메시지 줄도 함께 맞는다) */
  var RE_A_NOTICE = /^(\d{4})년 (\d{1,2})월 (\d{1,2})일 (오전|오후) (\d{1,2}):(\d{1,2}), (.+)$/;

  /* iOS: 날짜는 별도 헤더 줄, 메시지 줄에는 시각만 */
  var RE_I_MSG     = /^(오전|오후) (\d{1,2}):(\d{1,2}), (.*?) : ([\s\S]*)$/;
  var RE_I_NOTICE  = /^(오전|오후) (\d{1,2}):(\d{1,2}), (.+)$/;
  var RE_I_DATE    = /^(\d{4})년 (\d{1,2})월 (\d{1,2})일(?: \S+요일)?$/;
  /* 영문 로케일 변형: "Jan 3, 2024 at 9:05, name : body" */
  var RE_I_EN_MSG  = /^([A-Za-z]{3,9}) (\d{1,2}), (\d{4}) at (\d{1,2}):(\d{1,2})(?::(\d{1,2}))?(?:\s*([AaPp])\.?[Mm]\.?)?, (.*?) : ([\s\S]*)$/;
  var RE_I_EN_DATE = /^(?:[A-Za-z]+,\s*)?([A-Za-z]{3,9}) (\d{1,2}), (\d{4})$/;

  /* 윈도우 PC: 화자가 대괄호 안 */
  var RE_W_MSG    = /^\[(.*?)\] \[(오전|오후) (\d{1,2}):(\d{1,2})\] ([\s\S]*)$/;
  var RE_W_DATE   = /^-{3,}\s*(\d{4})년 (\d{1,2})월 (\d{1,2})일[^\n]*?-{3,}\s*$/;
  /* 윈도우 알림은 시각이 없어 본문 줄과 구분이 안 된다. 흔한 문구만 알림으로 본다. */
  var RE_W_NOTICE = /님(?:이|을) (?:들어왔|나갔|초대했|내보냈)습니다\.?$/;

  /* 방 이름: "OOO님과 카카오톡 대화" / "OOO 카카오톡 대화" */
  var RE_ROOM_WITH = /^(.*?)\s*님?과(?:의)?\s*카카오톡 대화$/;
  var RE_ROOM_BARE = /^(.*?)\s*카카오톡 대화$/;

  /* CSV Date 칸: "2024-01-03 09:05:00" / "2024년 1월 3일 오전 9:05" 등 */
  var RE_D_NUM = /^(\d{4})\s*[-\/.]\s*(\d{1,2})\s*[-\/.]\s*(\d{1,2})\.?(?:[T\s]+(?:(오전|오후|[AaPp][Mm])\s*)?(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/;
  var RE_D_KO  = /^(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일(?:\s*(?:\S+요일)?\s*(?:(오전|오후)\s*)?(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/;

  /* ------------------------------------------------------------- 잡동사니 */

  var hasOwn = Object.prototype.hasOwnProperty;

  /* 줄 끝 CR 제거 (split("\n") 뒤 CRLF 파일 대응) */
  function clip(line) {
    if (!line) return "";
    return line.charCodeAt(line.length - 1) === 13 ? line.slice(0, -1) : line;
  }

  /* 오전/오후 -> 24시간 */
  function hour24(ap, h) {
    if (ap === "오후" || ap === "PM" || ap === "pm" || ap === "Pm" || ap === "pM") {
      return h === 12 ? 12 : h + 12;
    }
    if (ap === "오전" || ap === "AM" || ap === "am" || ap === "Am" || ap === "aM") {
      return h === 12 ? 0 : h;
    }
    return h;                            // 표기가 없으면 이미 24시간제
  }

  function mkTime(y, mo, d, h, mi, s) {
    if (!y || !mo || !d) return null;
    var t = new Date(y, mo - 1, d, h || 0, mi || 0, s || 0, 0).getTime();
    return t !== t ? null : t;           // NaN 방어
  }

  /* 아무 형태의 날짜 문자열 -> epoch ms (macOS CSV 전용) */
  function parseAnyDate(s) {
    if (!s) return null;
    s = String(s).replace(RE_BOM, "").trim();
    if (!s) return null;
    var m = RE_D_KO.exec(s);
    if (m) return mkTime(+m[1], +m[2], +m[3], hour24(m[4], +(m[5] || 0)), +(m[6] || 0), +(m[7] || 0));
    m = RE_D_NUM.exec(s);
    if (m) return mkTime(+m[1], +m[2], +m[3], hour24(m[4], +(m[5] || 0)), +(m[6] || 0), +(m[7] || 0));
    return null;
  }

  function monthOf(word) {
    var k = String(word).slice(0, 3).toLowerCase();
    return hasOwn.call(MONTHS, k) ? MONTHS[k] : 0;
  }

  /* ------------------------------------------------------------- 포맷 판별 */

  function isCsvHeader(l0) {
    return l0.indexOf(",") >= 0 && /date/i.test(l0) && /user/i.test(l0) && /message/i.test(l0);
  }

  /* 앞부분만 표본으로 훑어 포맷 하나를 고른다. 못 고르면 null. */
  function detect(text) {
    if (typeof text !== "string" || !text) return null;
    var head = text.length > HEAD_BYTES ? text.slice(0, HEAD_BYTES) : text;
    head = head.replace(RE_BOM, "");

    var nl = head.indexOf("\n");
    var l0 = clip(nl < 0 ? head : head.slice(0, nl));
    if (isCsvHeader(l0)) return "macos";

    var lines = head.split("\n");
    var n = lines.length < HEAD_LINES ? lines.length : HEAD_LINES;
    var sa = 0, si = 0, sw = 0;
    for (var i = 0; i < n; i++) {
      var L = clip(lines[i]);
      if (!L) continue;
      var c = L.charCodeAt(0);
      if (c === 91) {                    // '['
        if (RE_W_MSG.test(L)) sw++;
        continue;
      }
      if (c === 45) {                    // '-'
        if (RE_W_DATE.test(L)) sw++;
        continue;
      }
      if (RE_A_NOTICE.test(L)) { sa++; continue; }
      if (RE_I_NOTICE.test(L) || RE_I_DATE.test(L) ||
          RE_I_EN_MSG.test(L) || RE_I_EN_DATE.test(L)) { si++; continue; }
    }
    if (sw > 0 && sw >= sa && sw >= si) return "windows";
    if (sa > 0 && sa >= si) return "android";
    if (si > 0) return "ios";
    // 메시지가 한 줄도 없는 빈 대화 파일
    if (RE_ROOM_BARE.test(l0)) return "android";
    return null;
  }

  /* ------------------------------------------------------------- CSV 파서 */

  /* 따옴표 이스케이프("" -> ")와 필드 안의 개행·쉼표를 처리하는 상태 기계.
   * 조각을 배열에 모았다가 join 하므로 큰 파일에서도 O(n). */
  function parseCsv(text) {
    var rows = [], row = [], parts = [];
    var start = 0, i = 0, n = text.length, inQ = false, quoted = false;

    function take(end) {
      if (end > start) parts.push(text.slice(start, end));
      var s = parts.length === 0 ? "" : parts.length === 1 ? parts[0] : parts.join("");
      parts.length = 0;
      if (quoted && s.indexOf("\r") >= 0) s = s.replace(/\r\n/g, "\n");
      quoted = false;
      return s;
    }

    while (i < n) {
      var ch = text.charCodeAt(i);
      if (inQ) {
        if (ch === 34) {                 // '"'
          if (text.charCodeAt(i + 1) === 34) {
            parts.push(text.slice(start, i + 1));   // 앞 따옴표 하나만 남긴다
            i += 2; start = i; continue;
          }
          parts.push(text.slice(start, i));
          inQ = false; i++; start = i; continue;
        }
        i++; continue;
      }
      if (ch === 34) {                   // 필드 시작 따옴표
        parts.push(text.slice(start, i));
        inQ = true; quoted = true; i++; start = i; continue;
      }
      if (ch === 44) {                   // ','
        row.push(take(i)); i++; start = i; continue;
      }
      if (ch === 10) {                   // '\n'
        var end = (i > start && text.charCodeAt(i - 1) === 13) ? i - 1 : i;
        row.push(take(end));
        rows.push(row); row = [];
        i++; start = i; continue;
      }
      i++;
    }
    if (start < n || parts.length || row.length) {
      var last = (n > start && text.charCodeAt(n - 1) === 13) ? n - 1 : n;
      row.push(take(last));
      rows.push(row);
    }
    // 마지막 줄이 개행만이었으면 빈 행이 하나 남는다
    if (rows.length && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === "") rows.pop();
    return rows;
  }

  /* ------------------------------------------------------------- 상태 기계 */

  function openMsg(st, t, who, body) {
    var m = { t: t, who: who, parts: [body] };
    st.raw.push(m);
    st.cur = m;
  }

  function contMsg(st, line) {
    if (st.cur) st.cur.parts.push(line);
  }

  function dayTime(st, h, mi) {
    return st.y ? mkTime(st.y, st.mo, st.d, h, mi, 0) : null;
  }

  function stepAndroid(L, st) {
    if (!L) { contMsg(st, ""); return; }
    var m = RE_A_MSG.exec(L);
    if (m) {
      openMsg(st, mkTime(+m[1], +m[2], +m[3], hour24(m[4], +m[5]), +m[6], 0), m[7], m[8]);
      return;
    }
    if (RE_A_NOTICE.test(L)) { st.notice++; st.cur = null; return; }
    contMsg(st, L);
  }

  function stepIos(L, st) {
    if (!L) { contMsg(st, ""); return; }
    var m = RE_I_MSG.exec(L);
    if (m) { openMsg(st, dayTime(st, hour24(m[1], +m[2]), +m[3]), m[4], m[5]); return; }
    m = RE_I_DATE.exec(L);
    if (m) { st.y = +m[1]; st.mo = +m[2]; st.d = +m[3]; st.cur = null; return; }
    if (RE_I_NOTICE.test(L)) { st.notice++; st.cur = null; return; }
    m = RE_I_EN_MSG.exec(L);
    if (m) {
      var mo = monthOf(m[1]);
      var h = m[7] ? hour24(/p/i.test(m[7]) ? "오후" : "오전", +m[4]) : +m[4];
      openMsg(st, mo ? mkTime(+m[3], mo, +m[2], h, +m[5], +(m[6] || 0)) : null, m[8], m[9]);
      return;
    }
    m = RE_I_EN_DATE.exec(L);
    if (m) {
      var mo2 = monthOf(m[1]);
      if (mo2) { st.y = +m[3]; st.mo = mo2; st.d = +m[2]; st.cur = null; return; }
    }
    contMsg(st, L);
  }

  function stepWindows(L, st) {
    if (!L) { contMsg(st, ""); return; }
    var c = L.charCodeAt(0);
    if (c === 91) {                      // '['
      var m = RE_W_MSG.exec(L);
      if (m) { openMsg(st, dayTime(st, hour24(m[2], +m[3]), +m[4]), m[1], m[5]); return; }
    } else if (c === 45) {               // '-'
      var d = RE_W_DATE.exec(L);
      if (d) { st.y = +d[1]; st.mo = +d[2]; st.d = +d[3]; st.cur = null; return; }
    }
    if (RE_W_NOTICE.test(L)) { st.notice++; st.cur = null; return; }
    contMsg(st, L);
  }

  function parseLines(text, st) {
    var lines = text.split("\n");        // 큰 문자열이라도 split 은 한 번만
    var fmt = st.fmt, i;
    st.room = roomOf(clip(lines[0]), fmt === "windows");
    if (fmt === "android") {
      for (i = 0; i < lines.length; i++) stepAndroid(clip(lines[i]), st);
    } else if (fmt === "ios") {
      for (i = 0; i < lines.length; i++) stepIos(clip(lines[i]), st);
    } else {
      for (i = 0; i < lines.length; i++) stepWindows(clip(lines[i]), st);
    }
  }

  function parseCsvLog(text, st) {
    var rows = parseCsv(text);
    if (!rows.length) return;
    var head = rows[0], di = 0, ui = 1, mi = 2;
    for (var i = 0; i < head.length; i++) {
      var h = String(head[i]).replace(RE_BOM, "").trim().toLowerCase();
      if (h === "date" || h === "날짜" || h === "시간") di = i;
      else if (h === "user" || h === "name" || h === "이름" || h === "보낸사람") ui = i;
      else if (h === "message" || h === "메시지" || h === "내용") mi = i;
    }
    for (var r = 1; r < rows.length; r++) {
      var row = rows[r];
      if (row.length < 2) {              // 깨진 줄은 직전 메시지에 이어 붙인다
        if (row.length === 1 && row[0]) contMsg(st, row[0]);
        continue;
      }
      var who = row[ui] == null ? "" : String(row[ui]).trim();
      var body = row[mi] == null ? "" : String(row[mi]);
      var t = parseAnyDate(row[di]);
      if (!who) {                        // 화자 없는 줄 = 시스템 알림
        if (body || t !== null) st.notice++;
        st.cur = null;
        continue;
      }
      openMsg(st, t, who, body);
    }
  }

  function roomOf(line, allowRaw) {
    if (!line) return null;
    line = line.replace(RE_BOM, "").trim();
    if (!line) return null;
    var m = RE_ROOM_WITH.exec(line);
    if (m) return m[1] || null;
    m = RE_ROOM_BARE.exec(line);
    if (m) return m[1] || null;
    if (!allowRaw) return null;
    if (RE_W_MSG.test(line) || RE_W_DATE.test(line)) return null;
    return line;
  }

  /* ------------------------------------------------------------- 마무리 */

  function isDropped(s) {
    if (hasOwn.call(DROP_EXACT, s)) return true;
    if (RE_PHOTOS.test(s)) return true;
    if (s.indexOf("파일: ") === 0) return true;
    if (s.indexOf("샵검색: ") === 0) return true;
    return false;
  }

  /* URL 제거. 제거한 자리에 생긴 군더더기 공백도 같이 정리한다. */
  function clean(s) {
    if (s.indexOf("http") >= 0) {
      s = s.replace(RE_URL, "");
      s = s.replace(/[ \t]{2,}/g, " ").replace(RE_TRAIL, "");
      s = s.replace(/\n{3,}/g, "\n\n").trim();
    }
    return s;
  }

  function finish(st) {
    var msgs = [], speakers = [], seen = {}, filtered = 0, first = null, last = null;
    for (var i = 0; i < st.raw.length; i++) {
      var m = st.raw[i];
      var who = m.who == null ? "" : m.who.trim();
      if (!who) { st.notice++; continue; }
      var key = "@" + who;
      if (seen[key] !== 1) { seen[key] = 1; speakers.push(who); }
      if (m.t !== null) {
        if (first === null || m.t < first) first = m.t;
        if (last === null || m.t > last) last = m.t;
      }
      var body = m.parts.length === 1 ? m.parts[0] : m.parts.join("\n");
      body = body.replace(RE_TRAIL, "").trim();
      if (isDropped(body)) { filtered++; continue; }
      body = clean(body);
      if (!body) { filtered++; continue; }   // URL 만 있던 메시지도 걸러진다
      msgs.push({ t: m.t, who: who, body: body });
    }
    return {
      ok: true,
      format: st.fmt,
      room: st.room,
      speakers: speakers,
      messages: msgs,
      first: first,
      last: last,
      noticeCount: st.notice,
      filteredCount: filtered
    };
  }

  function emptyResult() {
    return {
      ok: false, format: null, room: null, speakers: [], messages: [],
      first: null, last: null, noticeCount: 0, filteredCount: 0
    };
  }

  /* ------------------------------------------------------------- 공개 API */

  function parse(text) {
    if (typeof text !== "string" || !text) return emptyResult();
    try {
      text = text.replace(RE_BOM, "");
      var fmt = detect(text);
      if (!fmt) return emptyResult();
      var st = { fmt: fmt, room: null, raw: [], cur: null, notice: 0, y: 0, mo: 0, d: 0 };
      if (fmt === "macos") parseCsvLog(text, st);
      else parseLines(text, st);
      return finish(st);
    } catch (e) {
      return emptyResult();              // 어떤 경우에도 throw 하지 않는다
    }
  }

  /* 화자·기간으로 걸러 본문만 "\n" 으로 이어붙인다. t 가 null 인 메시지는 기간 필터를 통과. */
  function textOf(parsed, opt) {
    if (!parsed || !parsed.ok || !parsed.messages) return "";
    opt = opt || {};
    var list = opt.speakers, pick = null, k;
    if (list) {
      if (typeof list.has === "function") {
        pick = function (w) { return list.has(w); };
      } else if (typeof list.length === "number") {
        var map = {};
        for (k = 0; k < list.length; k++) map["@" + list[k]] = 1;
        pick = function (w) { return map["@" + w] === 1; };
      }
    }
    var from = opt.from == null ? null : opt.from;
    var to = opt.to == null ? null : opt.to;
    var out = [], ms = parsed.messages;
    for (var i = 0; i < ms.length; i++) {
      var m = ms[i];
      if (pick && !pick(m.who)) continue;
      if (m.t !== null && m.t !== undefined) {
        if (from !== null && m.t < from) continue;
        if (to !== null && m.t > to) continue;
      }
      out.push(m.body);
    }
    return out.join("\n");
  }

  /* ------------------------------------------------------------- 파일 읽기 */

  function badRatio(s) {
    if (!s) return 0;
    var bad = 0;
    for (var i = 0; i < s.length; i++) if (s.charCodeAt(i) === 0xFFFD) bad++;
    return bad / s.length;
  }

  function decodeWith(buf, enc) {
    try {
      return new root.TextDecoder(enc).decode(buf);
    } catch (e) {
      return null;
    }
  }

  /* utf-8 로 읽고, 깨진 글자가 너무 많으면 euc-kr 로 다시 읽어 더 나은 쪽을 준다. */
  function readFile(file) {
    return new Promise(function (resolve, reject) {
      if (!file) { reject(new Error("파일이 없습니다")); return; }
      if (typeof file.size === "number" && file.size > MAX_BYTES) {
        reject(new Error("파일이 너무 큽니다")); return;
      }
      var r = new root.FileReader();
      r.onerror = function () { reject(new Error("파일을 읽지 못했습니다")); };

      if (typeof root.TextDecoder === "function") {
        r.onload = function () {
          var buf = r.result;
          var utf = decodeWith(buf, "utf-8");
          if (utf === null) { reject(new Error("파일을 읽지 못했습니다")); return; }
          var ru = badRatio(utf);
          if (ru > BAD_RATIO) {
            var euc = decodeWith(buf, "euc-kr");
            if (euc !== null && badRatio(euc) < ru) { resolve(euc.replace(RE_BOM, "")); return; }
          }
          resolve(utf.replace(RE_BOM, ""));
        };
        r.readAsArrayBuffer(file);
        return;
      }

      // TextDecoder 가 없는 낡은 브라우저: FileReader 로 두 번 읽는다
      r.onload = function () {
        var utf = String(r.result);
        if (badRatio(utf) <= BAD_RATIO) { resolve(utf.replace(RE_BOM, "")); return; }
        var r2 = new root.FileReader();
        r2.onerror = function () { resolve(utf.replace(RE_BOM, "")); };
        r2.onload = function () {
          var euc = String(r2.result);
          resolve((badRatio(euc) < badRatio(utf) ? euc : utf).replace(RE_BOM, ""));
        };
        r2.readAsText(file, "euc-kr");
      };
      r.readAsText(file, "utf-8");
    });
  }

  root.KM_KAKAO = {
    detect: detect,
    parse: parse,
    textOf: textOf,
    readFile: readFile,
    parseCsv: parseCsv,
    FORMATS: FORMATS,
    MAX_BYTES: MAX_BYTES
  };
})(typeof window !== "undefined" ? window : globalThis);

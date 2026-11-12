/**
 * M1-1 · 批次 S · 农历 / 节假日 / 自然语言日期工具模块
 *
 * 来源：6.P0-T3基线\v2.0-t3.html 原文逐行对应
 *   - lunarToSolarDate ......................................... 9312-9322
 *   - LUNAR_INFO / LUNAR_MIN / LUNAR_MAX ....................... 9498-9500
 *   - leapMonth / leapDays / monthDays / lYearDays ............. 9501-9504
 *   - solarToLunar ............................................. 9505-9525
 *   - CN_NUM / LUNAR_MONTH_CN / TIANGAN / DIZHI ................ 9526-9529
 *   - lunarDayStr / lunarMonthStr / ganzhiYear ................. 9530-9532
 *   - SOLAR_FEST / LUNAR_FEST .................................. 9533-9534
 *   - HOLIDAY_REST / isRestDay ................................. 9535-9559
 *   - dayLabel ................................................. 9560-9573
 *   - parseNaturalDate ......................................... 9577-9653
 *
 * 约束：函数体表达式、查表字面量、提示与注释逐字保留；仅追加 export、TS 类型定义与
 *   纯类型层标注（返回对象形状 / 可空性），运行期数值与分支与产品件完全一致。
 */
import { pad, ymd } from '../core/utils';

/** 农历日期（solarToLunar 返回形状）。 */
export interface LunarDate {
  year: number;
  month: number;
  day: number;
  isLeap: boolean;
}

/** 公历日期（lunarToSolarDate 返回形状）。 */
export interface SolarDate {
  y: number;
  m: number;
  d: number;
}

/** 日历日格/周视图列头的副标注（农历或节日）。 */
export interface DayLabel {
  text: string;
  fest: boolean;
  rest: boolean;
}

/** 重复规则（与产品 n.recur 结构一致：{freq,interval,weekday?}）。 */
export interface RecurRule {
  freq: string;
  interval: number;
  weekday?: number;
}

/** 自然语言日期解析结果。 */
export interface NaturalDateResult {
  date: string | null;
  time: string | null;
  recur: RecurRule | null;
}

/* 农历表 */
export const LUNAR_INFO: number[] = [0x04bd8,0x04ae0,0x0a570,0x054d5,0x0d260,0x0d950,0x16554,0x056a0,0x09ad0,0x055d2,0x04ae0,0x0a5b6,0x0a4d0,0x0d250,0x1d255,0x0b540,0x0d6a0,0x0ada2,0x095b0,0x14977,0x04970,0x0a4b0,0x0b4b5,0x06a50,0x06d40,0x1ab54,0x02b60,0x09570,0x052f2,0x04970,0x06566,0x0d4a0,0x0ea50,0x06e95,0x05ad0,0x02b60,0x186e3,0x092e0,0x1c8d7,0x0c950,0x0d4a0,0x1d8a6,0x0b550,0x056a0,0x1a5b4,0x025d0,0x092d0,0x0d2b2,0x0a950,0x0b557,0x06ca0,0x0b550,0x15355,0x04da0,0x0a5b0,0x14573,0x052b0,0x0a9a8,0x0e950,0x06aa0,0x0aea6,0x0ab50,0x04b60,0x0aae4,0x0a570,0x05260,0x0f263,0x0d950,0x05b57,0x056a0,0x096d0,0x04dd5,0x04ad0,0x0a4d0,0x0d4d4,0x0d250,0x0d558,0x0b540,0x0b6a0,0x195a6,0x095b0,0x049b0,0x0a974,0x0a4b0,0x0b27a,0x06a50,0x06d40,0x0af46,0x0ab60,0x09570,0x04af5,0x04970,0x064b0,0x074a3,0x0ea50,0x06b58,0x055c0,0x0ab60,0x096d5,0x092e0,0x0c960,0x0d954,0x0d4a0,0x0da50,0x07552,0x056a0,0x0abb7,0x025d0,0x092d0,0x0cab5,0x0a950,0x0b4a0,0x0baa4,0x0ad50,0x055d9,0x04ba0,0x0a5b0,0x15176,0x052b0,0x0a930,0x07954,0x06aa0,0x0ad50,0x05b52,0x04b60,0x0a6e6,0x0a4e0,0x0d260,0x0ea65,0x0d530,0x05aa0,0x076a3,0x096d0,0x04afb,0x04ad0,0x0a4d0,0x1d0b6,0x0d250,0x0d520,0x0dd45,0x0b5a0,0x056d0,0x055b2,0x049b0,0x0a577,0x0a4b0,0x0aa50,0x1b255,0x06d20,0x0ada0];
export const LUNAR_MIN = 1900, LUNAR_MAX = 1900 + LUNAR_INFO.length - 1;
export function leapMonth(y: number): number { return LUNAR_INFO[y - 1900] & 0xf; }
export function leapDays(y: number): number { if(!leapMonth(y))return 0;return (LUNAR_INFO[y - 1900] & 0x10000) ? 30 : 29; }
export function monthDays(y: number, m: number): number { return (LUNAR_INFO[y - 1900] & (0x10000 >> m)) ? 30 : 29; }
export function lYearDays(y: number): number { let s = 348;for(let i = 0x8000;i > 0x8;i >>= 1)s += (LUNAR_INFO[y - 1900] & i) ? 1 : 0;return s + leapDays(y); }
export function solarToLunar(y: number, m: number, d: number): LunarDate | null {
  if(y < LUNAR_MIN || y > LUNAR_MAX)return null;
  let offset = Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(1900, 0, 31)) / 86400000);
  if(offset < 0)return null;
  let i: number, temp = 0;
  for(i = 1900;i <= LUNAR_MAX && offset > 0;i++){temp = lYearDays(i);offset -= temp;}
  if(offset < 0){offset += temp;i--;}
  const year = i, leap = leapMonth(year);
  let isLeap = false, j: number;
  for(j = 1;j < 13 && offset > 0;j++){
    if(leap > 0 && j === leap + 1 && !isLeap){--j;isLeap = true;temp = leapDays(year);}
    else temp = monthDays(year, j);
    if(isLeap && j === leap + 1)isLeap = false;
    offset -= temp;
  }
  if(offset === 0 && leap > 0 && j === leap + 1){if(isLeap){isLeap = false;}else{isLeap = true;--j;}}
  if(offset < 0){offset += temp;--j;}
  const month = j, day = offset + 1;
  if(month < 1 || month > 12 || day < 1 || day > 30)return null;
  return { year, month, day, isLeap };
}
export const CN_NUM: string[] = ['','一','二','三','四','五','六','七','八','九','十'];
export const LUNAR_MONTH_CN: string[] = ['','正','二','三','四','五','六','七','八','九','十','冬','腊'];
export const TIANGAN: string[] = ['','甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
export const DIZHI: string[] = ['','子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
export function lunarDayStr(d: number): string { if(d === 10)return '初十';if(d === 20)return '二十';if(d === 30)return '三十';const p = ['初','十','廿','卅'][Math.floor(d / 10)];return p + CN_NUM[d % 10]; }
export function lunarMonthStr(m: number): string { return LUNAR_MONTH_CN[m] + '月'; }
export function ganzhiYear(y: number): string { const i = (y - 4) % 60;return TIANGAN[i % 10 + 1] + DIZHI[i % 12 + 1]; }
export const SOLAR_FEST: Record<string, string> = { '01-01': '元旦', '02-14': '情人节', '03-08': '妇女节', '03-12': '植树节', '04-01': '愚人节', '05-01': '劳动节', '05-04': '青年节', '06-01': '儿童节', '07-01': '建党节', '08-01': '建军节', '09-10': '教师节', '10-01': '国庆节', '12-24': '平安夜', '12-25': '圣诞节' };
export const LUNAR_FEST: Record<string, string> = { '1-1': '春节', '1-15': '元宵', '2-2': '龙抬头', '5-5': '端午', '7-7': '七夕', '7-15': '中元', '8-15': '中秋', '9-9': '重阳', '12-8': '腊八' };
/* 法定节假日（休）数据：来源为国务院办公厅各年度《部分节假日安排的通知》，
   每项为 [起年,起月,起日,止年,止月,止日]，按年份升序；仅收录通知中的放假日期（含周末连休），
   调休上班日不收录（如2026年9月20日、10月10日）。2027年安排待国务院发布后补充。 */
export const HOLIDAY_REST: number[][] = [
  /* 2024（国办发明电〔2023〕7号） */
  [2024,1,1,2024,1,1],[2024,2,10,2024,2,17],[2024,4,4,2024,4,6],[2024,5,1,2024,5,5],[2024,6,10,2024,6,10],[2024,9,15,2024,9,17],[2024,10,1,2024,10,7],
  /* 2025（国办发明电〔2024〕6号） */
  [2025,1,1,2025,1,1],[2025,1,28,2025,2,4],[2025,4,4,2025,4,6],[2025,5,1,2025,5,5],[2025,5,31,2025,6,2],[2025,10,1,2025,10,8],
  /* 2026（国办发明电〔2025〕7号） */
  [2026,1,1,2026,1,3],[2026,2,15,2026,2,23],[2026,4,4,2026,4,6],[2026,5,1,2026,5,5],[2026,6,19,2026,6,21],[2026,9,25,2026,9,27],[2026,10,1,2026,10,7]
  /* FIX-i18n-2: 2027 及以后数据待国务院办公厅发布《部分节假日安排的通知》后补充；
     节假日排班属外部权威数据，禁止编造。超出本表范围的日期 isRestDay 返回 false（见下），
     即不标注法定休假日（周末/其他标注逻辑不变），属合理降级而非顺延/回退。 */
];
export function isRestDay(y: number, m: number, d: number): boolean {
  const t = y * 10000 + m * 100 + d;
  for(let i = 0;i < HOLIDAY_REST.length;i++){
    const a = HOLIDAY_REST[i];
    const s = a[0] * 10000 + a[1] * 100 + a[2], e = a[3] * 10000 + a[4] * 100 + a[5];
    if(t >= s && t <= e)return true;
    if(a[0] > y)return false;
  }
  /* FIX-i18n-2: 表尾未覆盖（含 2027+）时落到这里——无顺延/回退，返回 false 视为非法定休假日 */
  return false;
}
export function dayLabel(date: Date): DayLabel {
  const y = date.getFullYear(), m = date.getMonth() + 1, d = date.getDate();
  const key = pad(m) + '-' + pad(d);
  const rest = isRestDay(y, m, d);
  if(SOLAR_FEST[key])return { text: SOLAR_FEST[key], fest: true, rest };
  const lu = solarToLunar(y, m, d);
  if(lu){
    const lk = lu.month + '-' + lu.day;
    if(!lu.isLeap && LUNAR_FEST[lk])return { text: LUNAR_FEST[lk], fest: true, rest };
    if(lu.day === 1)return { text: (lu.isLeap ? '闰' : '') + lunarMonthStr(lu.month), fest: false, rest };
    return { text: lunarDayStr(lu.day), fest: false, rest };
  }
  return { text: '', fest: false, rest };
}
/* 找公历年份 y 中农历 (lM,lD) 对应的公历日期；某年缺该农历日（如部分年份无大年三十）时返回 null */
export function lunarToSolarDate(y: number, lM: number, lD: number): SolarDate | null {
  for(let m = 1;m <= 12;m++){
    const dim = new Date(y, m, 0).getDate();
    for(let d = 1;d <= dim;d++){
      const lu = solarToLunar(y, m, d);
      if(lu && lu.month === lM && lu.day === lD)return { y, m, d };
    }
  }
  return null;
}
export function parseNaturalDate(str: string): NaturalDateResult | null {
  str = str.trim().toLowerCase();
  const now = new Date();
  const result: NaturalDateResult = { date: null, time: null, recur: null };
  const recurMap: Record<string, RecurRule> = {
    '每周一': { freq: 'weekly', interval: 1, weekday: 1 },
    '每周二': { freq: 'weekly', interval: 1, weekday: 2 },
    '每周三': { freq: 'weekly', interval: 1, weekday: 3 },
    '每周四': { freq: 'weekly', interval: 1, weekday: 4 },
    '每周五': { freq: 'weekly', interval: 1, weekday: 5 },
    '每周六': { freq: 'weekly', interval: 1, weekday: 6 },
    '每周日': { freq: 'weekly', interval: 1, weekday: 0 },
    '每周天': { freq: 'weekly', interval: 1, weekday: 0 },
    '每天': { freq: 'daily', interval: 1 },'每日': { freq: 'daily', interval: 1 },
    '每周': { freq: 'weekly', interval: 1 },
    '每月': { freq: 'monthly', interval: 1 },'每年': { freq: 'yearly', interval: 1 },
    '每法定工作日': { freq: 'workday', interval: 1 },'法定工作日': { freq: 'workday', interval: 1 },'工作日': { freq: 'workday', interval: 1 },
    '农历年重复': { freq: 'lunar', interval: 1 },'农历年': { freq: 'lunar', interval: 1 },'农历': { freq: 'lunar', interval: 1 }
  };
  const _recurKeys = Object.keys(recurMap).sort((a, b) => b.length - a.length);
  for(const key of _recurKeys){
    if(str.includes(key)){result.recur = recurMap[key];break;}
  }
  if(str.includes('明天'))result.date = ymd(new Date(now.getTime() + 86400000));
  else if(str.includes('后天'))result.date = ymd(new Date(now.getTime() + 2 * 86400000));
  else if(str.includes('今天') || str.includes('今日'))result.date = ymd(now);
  else if(str.includes('下周')){
    const dayMap: Record<string, number> = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 0, '天': 0 };
    let found = false;
    for(const d in dayMap){
      if(str.includes('下周' + d)){
        const target = dayMap[d];
        const cur = now.getDay();
        const daysToNextMonday = cur === 0 ? 1 : (8 - cur);
        const nextMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysToNextMonday);
        const offset = (target === 0 ? 6 : target - 1);
        const targetDate = new Date(nextMonday.getFullYear(), nextMonday.getMonth(), nextMonday.getDate() + offset);
        result.date = ymd(targetDate);found = true;break;
      }
    }
    if(!found)result.date = ymd(new Date(now.getTime() + 7 * 86400000));
  }else{
    const m2 = str.match(/(\d{1,2})月(\d{1,2})[号日]?/);
    if(m2){
      const mo = parseInt(m2[1]) - 1;
      const da = parseInt(m2[2]);
      const yr = now.getFullYear();
      let dt = new Date(yr, mo, da);
      if(dt < now)dt = new Date(yr + 1, mo, da);
      result.date = ymd(dt);
    }
  }
  let _period: 'am' | 'pm' | null = null;
  if(/下午|晚上|傍晚/.test(str))_period = 'pm';
  else if(/上午|早上|凌晨/.test(str))_period = 'am';
  const tm = str.match(/(\d{1,2})[:点：](\d{1,2})?/);
  if(tm){
    let h = parseInt(tm[1], 10);
    let mi = tm[2] ? parseInt(tm[2], 10) : 0;
    if(!isNaN(h) && h >= 0 && h <= 23){
      if(isNaN(mi) || mi < 0 || mi > 59)mi = 0;
      if(_period === 'pm' && h < 12)h += 12;
      if(_period === 'am' && h === 12)h = 0;
      result.time = pad(h) + ':' + pad(mi);
    }
  }else if(str.includes('早上') || str.includes('上午')){result.time = '09:00';}
  else if(str.includes('下午')){result.time = '14:00';}
  else if(str.includes('晚上')){result.time = '19:00';}
  if(result.recur && result.recur.weekday != null && !result.date){
    const _now = new Date();
    const _cur = _now.getDay();
    let _diff = (result.recur.weekday as number) - _cur;
    if(_diff < 0)_diff += 7;
    result.date = ymd(new Date(_now.getFullYear(), _now.getMonth(), _now.getDate() + _diff));
  }
  return (result.date || result.time || result.recur) ? result : null;
}

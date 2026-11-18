// Only anonymous, aggregated website audience is exposed. OAuth never leaves the server.
const COUNTER = '32072156';
const ORIGIN = 'https://niksitme.github.io';
const DAY = 86400000;
const iso = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
const day = (date, n) => new Date(Date.parse(date) + n * DAY).toISOString().slice(0,10);
export function moscowToday(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).map(p=>[p.type,p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
export function optionsFromUrl(url, today) {
  const from = url.searchParams.get('from'), to = url.searchParams.get('to'), step = url.searchParams.get('step');
  if (!iso(from) || !iso(to) || from > to || from < '2024-01-01' || (Date.parse(to)-Date.parse(from))/DAY > 3660 || !['day','week','month','year'].includes(step)) return null;
  return {from, to, step, through: to < day(today,-1) ? to : day(today,-1)};
}
export function parseReport(report, options, generatedAt) {
  if (report.sampled || report.sample_share !== undefined && report.sample_share < 1) throw new Error('sampled');
  const intervals = report.time_intervals, values = report.totals?.[0];
  if (!Array.isArray(intervals) || !Array.isArray(values) || intervals.length !== values.length) throw new Error('invalid_report');
  let last = '';
  const points = intervals.map(([from,to],i)=>{
    const users = values[i];
    if (!iso(from) || !iso(to) || from > to || from < options.from || to > options.through || from <= last || typeof users !== 'number' || !Number.isFinite(users) || users < 0) throw new Error('invalid_report');
    last = to;
    return {from,to,users:Math.round(users)};
  });
  return {version:1,counter:COUNTER,metric:'ym:s:users',timezone:'Europe/Moscow',scope:'website',step:options.step,from:options.from,to:options.to,through:options.through,generated_at:generatedAt,sampled:false,points};
}
export function createHandler({token,fetcher=fetch,now=()=>new Date()}) {
  const cache = new Map(), pending = new Map();
  return async request => {
    const origin = request.headers.get('origin');
    const local = /^http:\/\/127\.0\.0\.1:\d+$/.test(origin || '');
    const headers = {'content-type':'application/json; charset=utf-8','cache-control':'no-store','vary':'Origin','access-control-allow-origin':local?origin:ORIGIN,'access-control-allow-headers':'apikey, authorization, content-type','access-control-allow-methods':'GET, OPTIONS'};
    const json = (body,status=200)=>new Response(JSON.stringify(body),{status,headers});
    if (origin && origin !== ORIGIN && !local) return json({error:'origin_not_allowed'},403);
    if (request.method === 'OPTIONS') return new Response(null,{status:204,headers});
    if (request.method !== 'GET') return json({error:'method_not_allowed'},405);
    const at = now(), options = optionsFromUrl(new URL(request.url), moscowToday(at));
    if (!options) return json({error:'invalid_range'},400);
    if (!token) return json({error:'metrika_not_configured'},503);
    if (options.from > options.through) return json({version:1,metric:'ym:s:users',scope:'website',timezone:'Europe/Moscow',...options,generated_at:at.toISOString(),sampled:false,points:[]});
    const key = [options.from,options.to,options.step,options.through].join('|');
    const hit = cache.get(key);
    if (hit && +at-hit.at < 600000) return json(hit.data);
    if (!pending.has(key)) {
      if (pending.size >= 3) return json({error:'busy'},429);
      pending.set(key,(async()=>{
        const params = new URLSearchParams({ids:COUNTER,metrics:'ym:s:users',date1:options.from,date2:options.through,group:options.step,accuracy:'full',timezone:'+03:00'});
        const response = await fetcher(`https://api-metrika.yandex.net/stat/v1/data/bytime?${params}`,{headers:{Authorization:`OAuth ${token}`},signal:AbortSignal.timeout(90000)});
        if (!response.ok) throw new Error('upstream_unavailable');
        const data = parseReport(await response.json(), options, at.toISOString());
        if (cache.size >= 50) cache.delete(cache.keys().next().value);
        cache.set(key,{at:+at,data});
        return data;
      })());
    }
    try {return json(await pending.get(key));}
    catch {return json({error:'metrika_unavailable'},502);}
    finally {pending.delete(key);}
  };
}

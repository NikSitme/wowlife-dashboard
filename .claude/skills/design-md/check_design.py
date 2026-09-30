import re,sys,yaml
src=open(sys.argv[1]).read()
fm=yaml.safe_load(src.split('---')[1]); body=src.split('---',2)[2]
order=["overview|brand & style","colors","typography","layout|layout & spacing","elevation & depth|elevation","shapes","components","do's and don'ts"]
heads=[h.strip().lower() for h in re.findall(r'^## (.+)$',body,re.M)]
idx=[next(i for i,o in enumerate(order) if h in o.split('|')) for h in heads]
print("sections",heads,"order ok" if idx==sorted(idx) else "ORDER WARNING", "dupes" if len(set(heads))!=len(heads) else "no dupes")
def res(ref):
    cur=fm
    for p in ref.split('.'): cur=cur[p]
    return cur
errs=0
for ref in set(re.findall(r'\{([a-z0-9.\-]+)\}',src)):
    try: res(ref)
    except Exception: print("BROKEN REF",ref); errs+=1
def lum(h):
    h=h.lstrip('#'); c=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    c=[x/12.92 if x<=0.03928 else ((x+0.055)/1.055)**2.4 for x in c]
    return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2]
def cr(a,b):
    A,B=sorted([lum(a),lum(b)],reverse=True); return (A+0.05)/(B+0.05)
used=set()
for name,c in fm['components'].items():
    vals={k:(res(v[1:-1]) if isinstance(v,str) and v.startswith('{') else v) for k,v in c.items()}
    for v in c.values():
        if isinstance(v,str) and v.startswith('{colors.'): used.add(v[8:-1])
    if 'backgroundColor' in vals and 'textColor' in vals:
        r=cr(vals['backgroundColor'],vals['textColor']); print(f"{name:22s} {r:5.2f}:1 {'OK' if r>=4.5 else 'BELOW AA'}")
# eyebrow on paper
print("eyebrow brick on paper", round(cr(fm['colors']['tertiary'],fm['colors']['neutral']),2), "on deep", round(cr(fm['colors']['tertiary'],fm['colors']['surface-deep']),2))
print("variant on deep", round(cr(fm['colors']['on-surface-variant'],fm['colors']['surface-deep']),2))
orph=set(fm['colors'])-used; print("orphaned colors:",orph or "none"); print("broken refs:",errs)

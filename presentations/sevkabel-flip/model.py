buy=13_500_000; reno=900_000; inv=buy+reno
def calc(sale, months, tax_prog=False):
    gain=sale-buy
    tax = gain*0.13 if not tax_prog else (min(gain,2.4e6)*0.13+max(gain-2.4e6,0)*0.15)
    net=sale-inv-tax; invp=net/2
    return tax, net, invp, invp/inv, invp/inv*12/months
t,n,i,r,ra=calc(18e6,4); print("base",t,n,i,round(r*100,2),round(ra*100,2), "total roi", round(n/inv*100,2), round(n/inv*300,2))
print("prog tax", calc(18e6,4,True)[:3])
be = (inv - 0.13*buy)/0.87; print("breakeven sale", be, "drop", 1-be/18e6)
for s in [16e6,17e6,18e6,19e6]:
    print(s/1e6, [ (round(calc(s,m)[2]/1e3), round(calc(s,m)[4]*100,1)) for m in (4,6,8)])
print("vs legenda 3k min 30.9", 1-18/30.9)
print("capital structure", buy/inv, reno/inv)

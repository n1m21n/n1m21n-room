import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from scenes import *
from PIL import Image, ImageDraw, ImageFont
ST=os.path.join(os.path.dirname(os.path.abspath(__file__)),'../../build-cache/review/stills/')
OUT=sys.argv[1] if len(sys.argv)>1 else ST
def font(sz,b=False):
  f='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf' if b else '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
  try: return ImageFont.truetype(f,sz)
  except: return ImageFont.load_default()
F=font(22); FB=font(26,True); FT=font(40,True); FS=font(20)
def wrap(d,txt,f,w):
  out=[];line=''
  for word in txt.split():
    t=(line+' '+word).strip()
    if d.textlength(t,font=f)<=w: line=t
    else: out.append(line); line=word
  out.append(line); return out
def still(sid): return Image.open(ST+f'epm-{sid}.png').convert('RGB')
def col_of(sid): return [a[4] for a in ACTS if a[0]==sid.split('-')[0]][0]
for (aid,name,b0,b1,col,music,dens,cscript) in ACTS:
  sc=[s for s in S if s[0].split('-')[0]==aid]
  W=760; IH=int(W*9/16); CH=222; pad=24; head=150; rows=(len(sc)+1)//2
  img=Image.new('RGB',(2*W+3*pad, head+rows*(IH+CH+pad)+pad),'#0A0618'); d=ImageDraw.Draw(img)
  d.rectangle([0,0,img.width,head-20],fill=col)
  d.text((pad,22),f"ACT {aid}  {name.upper()}",font=FT,fill='white')
  d.text((pad,72),f"bars {b0}-{b1}   {tc(b0)}-{tc(b1+1)}   {music}",font=F,fill='white')
  d.text((pad,102),f"density {dens}   colour: {cscript}",font=FS,fill='white')
  for i,(sid,a,b,cam,act,cut,light) in enumerate(sc):
    x=pad+(i%2)*(W+pad); y=head+(i//2)*(IH+CH+pad)
    img.paste(still(sid).resize((W,IH)),(x,y)); d.rectangle([x,y,x+W,y+IH],outline=col,width=3)
    ty=y+IH+8
    d.text((x,ty),f"{sid}   b{a}-{b}   {tc(a)}",font=FB,fill='#B8B5F0'); ty+=36
    for line in wrap(d,act,F,W)[:3]: d.text((x,ty),line,font=F,fill='white'); ty+=28
    d.text((x,ty),'cam: '+cam,font=FS,fill='#B8B5F0'); ty+=26
    d.text((x,ty),'cut: '+cut,font=FS,fill='#B8B5F0'); ty+=26
    d.text((x,ty),'light: '+light,font=FS,fill='#FFE14D')
  img.save(OUT+f'epm_act_{aid}.png')
W,IH=320,180; cols=5; rows=(len(S)+cols-1)//cols
img=Image.new('RGB',(cols*W+(cols+1)*12,170+rows*(IH+54)),'#0A0618'); d=ImageDraw.Draw(img)
d.text((12,14),"EK PINJARE MAI in the room   contact sheet r1   153 BPM   2:41.6   103 bars",font=FB,fill='white')
tw=img.width-24
for (aid,name,b0,b1,col,*_) in ACTS:
  x0=12+tw*(b0-1)/N_BARS; x1=12+tw*b1/N_BARS; d.rectangle([x0,60,x1,110],fill=col); d.text((x0+4,68),aid,font=FS,fill='white')
for s in S:
  x=12+tw*(s[1]-1)/N_BARS; d.line([x,110,x,124],fill='white',width=2)
for bb,lab in [(25,'drop'),(57,'mouth'),(83,'peak'),(96,'hold')]:
  x=12+tw*(bb-1)/N_BARS; d.text((x+3,126),lab,font=FS,fill='#FFE14D')
for i,s in enumerate(S):
  x=12+(i%cols)*(W+12); y=170+(i//cols)*(IH+54)
  img.paste(still(s[0]).resize((W,IH)),(x,y)); d.rectangle([x,y,x+W,y+IH],outline=col_of(s[0]),width=3)
  d.text((x,y+IH+6),f"{s[0]}  b{s[1]}  {tc(s[1])}",font=FS,fill='white')
img.save(OUT+'epm_contact_sheet.png'); print(img.size)
cw,chh=110,62
img=Image.new('RGB',(12+len(S)*(cw+4),300),'#0A0618'); d=ImageDraw.Draw(img)
d.text((12,10),"colour script   (top: colour masses, middle: value, bottom: act)",font=FS,fill='white')
for i,s_ in enumerate(S):
  x=12+i*(cw+4); src=still(s_[0]); flat=src.resize((8,5),Image.BILINEAR).resize((cw,chh),Image.NEAREST)
  img.paste(flat,(x,44)); img.paste(flat.convert('L').convert('RGB'),(x,44+chh+6))
  d.rectangle([x,44+2*chh+14,x+cw,44+2*chh+30],fill=col_of(s_[0])); d.text((x+2,44+2*chh+34),s_[0],font=FS,fill='white')
img.save(OUT+'epm_colour_script.png')

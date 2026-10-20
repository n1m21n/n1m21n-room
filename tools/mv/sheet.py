import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from scenes import *
from lights import L
from PIL import Image, ImageDraw, ImageFont
ST=os.path.join(os.path.dirname(os.path.abspath(__file__)),'../../build-cache/review/stills/')
OUT=sys.argv[1] if len(sys.argv)>1 else ST
def font(sz,b=False):
  for f in (['/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'] if b else ['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf']):
    try: return ImageFont.truetype(f,sz)
    except: pass
  return ImageFont.load_default()
F=font(22); FB=font(26,True); FT=font(40,True); FS=font(20)
def wrap(d,txt,f,w):
  out=[];line=''
  for word in txt.split():
    t=(line+' '+word).strip()
    if d.textlength(t,font=f)<=w: line=t
    else: out.append(line); line=word
  out.append(line); return out
for (aid,name,b0,b1,music,col,dens,cscript) in ACTS:
  sc=[s for s in S if s[0].split('-')[0]==aid]
  cols=2; W=760; IH=int(W*9/16); CH=222; pad=24
  rows=(len(sc)+1)//2
  head=150
  img=Image.new('RGB',(cols*W+(cols+1)*pad, head+rows*(IH+CH+pad)+pad),'#0A0618'); d=ImageDraw.Draw(img)
  d.rectangle([0,0,img.width,head-20],fill=col)
  d.text((pad,22),f"ACT {aid}  {name.upper()}",font=FT,fill='white')
  d.text((pad,72),f"bars {b0}-{b1}   {tc(b0)}-{tc(b1+1)}   {music}",font=F,fill='white')
  d.text((pad,102),f"density {dens}   colour: {cscript}",font=FS,fill='white')
  for i,(sid,a,b,cam,act,cut) in enumerate(sc):
    x=pad+(i%2)*(W+pad); y=head+(i//2)*(IH+CH+pad)
    im=Image.open(ST+f'mvL-{sid}.png').convert('RGB').resize((W,IH)); img.paste(im,(x,y))
    if os.path.exists(ST+f'mvF-{sid}.png'):
      fw,fh=W//3,IH//3; fl=Image.open(ST+f'mvF-{sid}.png').convert('RGB').resize((fw,fh)); img.paste(fl,(x+W-fw-8,y+8)); d.rectangle([x+W-fw-8,y+8,x+W-8,y+8+fh],outline='white',width=2); d.text((x+W-fw-4,y+fh-16),'on the beat',font=FS,fill='white')
    d.rectangle([x,y,x+W,y+IH],outline=col,width=3)
    ty=y+IH+8
    d.text((x,ty),f"{sid}   b{a}-{b}   {tc(a)}",font=FB,fill=col if aid!='I' else '#8C82FF'); ty+=36
    for line in wrap(d,act,F,W)[:3]: d.text((x,ty),line,font=F,fill='white'); ty+=28
    d.text((x,ty),'cam: '+cam,font=FS,fill='#B8B5F0'); ty+=26
    d.text((x,ty),'cut: '+cut,font=FS,fill='#B8B5F0'); ty+=26
    d.text((x,ty),'light: '+L[sid]['cue'],font=FS,fill='#FFE14D')
  img.save(OUT+f'contact_act_{aid}.png')
# overview: all scenes, time-proportional strip + 6x5 grid
W,IH=320,180
cols=5; rows=(len(S)+cols-1)//cols
img=Image.new('RGB',(cols*W+(cols+1)*12, 170+rows*(IH+54)),'#0A0618'); d=ImageDraw.Draw(img)
d.text((12,14),"BRING ME SOME CHANGE  contact sheet r2   138 BPM   2:29.6   86 bars",font=FB,fill='white')
# timeline
tw=img.width-24; total=86
for (aid,name,b0,b1,music,col,*_) in ACTS:
  x0=12+tw*(b0-1)/total; x1=12+tw*b1/total; d.rectangle([x0,60,x1,110],fill=col); d.text((x0+6,68),f"{aid} {name}",font=FS,fill='white' if aid!='V' else 'black')
for s in S:
  x=12+tw*(s[1]-1)/total; d.line([x,110,x,124],fill='white',width=2)
for bb,lab in [(47,'break'),(59,'peak'),(83,'silence')]:
  x=12+tw*(bb-1)/total; d.text((x+3,126),lab,font=FS,fill='#FFE14D')
for i,s in enumerate(S):
  x=12+(i%cols)*(W+12); y=170+(i//cols)*(IH+54)
  col=[a[5] for a in ACTS if a[0]==s[0].split('-')[0]][0]
  img.paste(Image.open(ST+f'mvL-{s[0]}.png').convert('RGB').resize((W,IH)),(x,y)); d.rectangle([x,y,x+W,y+IH],outline=col,width=3)
  d.text((x,y+IH+6),f"{s[0]}  b{s[1]}  {tc(s[1])}",font=FS,fill='white')
img.save(OUT+'contact_sheet.png')
print(img.size)

# colour script: flat masses per scene (colour row) + value row (greyscale), one cell per scene in order
cw, chh = 110, 62
img = Image.new('RGB', (12 + len(S) * (cw + 4), 300), '#0A0618'); d = ImageDraw.Draw(img)
d.text((12, 10), "colour script r2   (top: colour masses, middle: value, bottom: act)", font=FS, fill='white')
for i, s_ in enumerate(S):
  x = 12 + i * (cw + 4)
  src = Image.open(ST + f'mvL-{s_[0]}.png').convert('RGB')
  flat = src.resize((8, 5), Image.BILINEAR).resize((cw, chh), Image.NEAREST)
  img.paste(flat, (x, 44)); img.paste(flat.convert('L').convert('RGB'), (x, 44 + chh + 6))
  col = [a[5] for a in ACTS if a[0] == s_[0].split('-')[0]][0]
  d.rectangle([x, 44 + 2 * chh + 14, x + cw, 44 + 2 * chh + 30], fill=col)
  d.text((x + 2, 44 + 2 * chh + 34), s_[0], font=FS, fill='white')
img.save(OUT + 'colour_script.png')

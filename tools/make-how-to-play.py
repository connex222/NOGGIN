#!/usr/bin/env python3
"""Generate a one-page, print-ready guide from live game catalogs and board rules.
Run `python tools/make-how-to-play.py` from any directory after editing the rules.
"""
from pathlib import Path
import subprocess, json, sys
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, Color
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import stringWidth

ROOT=Path(__file__).resolve().parents[1]
OUT=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else ROOT/'HOW-TO-PLAY.pdf'
data=json.loads(subprocess.check_output(['node',str(ROOT/'tools/export-guide-data.js')],cwd=ROOT,text=True))
fonts=('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf','/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf')
if all(Path(x).exists() for x in fonts):
    pdfmetrics.registerFont(TTFont('Noggin',fonts[0]))
    pdfmetrics.registerFont(TTFont('Noggin-Bold',fonts[1]))
else:
    fonts=('Helvetica','Helvetica-Bold')
REG='Noggin' if fonts[0].endswith('.ttf') else fonts[0]
BOLD='Noggin-Bold' if fonts[1].endswith('.ttf') else fonts[1]
NAVY=HexColor('#10203C'); PURPLE=HexColor('#30275E'); GOLD=HexColor('#F6C963'); BLUE=HexColor('#3178B9'); WHITE=HexColor('#FFFFFF'); LIGHT=HexColor('#EAF0F6'); MUTE=HexColor('#52647B')
W,H=A4;c=canvas.Canvas(str(OUT),pagesize=A4);c.setTitle('NOGGIN — How to Play');c.setAuthor('NOGGIN game rules (generated from game source)')
def text(x,y,s,size=9,color=NAVY,bold=False):
 c.setFont(BOLD if bold else REG,size);c.setFillColor(color);c.drawString(x,y,s)
def linewrap(s,max_width,size=8.4,bold=False):
 words=s.split();lines=[];cur='';fn=BOLD if bold else REG
 for word in words:
  candidate=(cur+' '+word).strip()
  if stringWidth(candidate,fn,size)>max_width and cur:lines.append(cur);cur=word
  else:cur=candidate
 if cur:lines.append(cur)
 return lines
def para(x,y,s,width,size=8.8,leading=13,color=NAVY,bold=False):
 for line in linewrap(s,width,size,bold):text(x,y,line,size,color,bold);y-=leading
 return y

def heading(x,y,name,width):
 c.setFillColor(PURPLE);c.roundRect(x,y-13,width,24,6,fill=1,stroke=0)
 text(x+10,y-5,name,10,WHITE,True)
 return y-32

def tag(x,y,s,width):
 c.setFillColor(LIGHT);c.roundRect(x,y-15,width,22,5,fill=1,stroke=0)
 text(x+8,y-8,s,8.3,NAVY,True)
 return y-29
# Masthead
c.setFillColor(NAVY);c.rect(0,H-137,W,137,fill=1,stroke=0)
for i in range(4):
 c.setStrokeColor(HexColor(['#6fd4d7','#f9bf61','#fe789b','#ac8ff0'][i]));c.setLineWidth(5);c.line(35+145*i,H-133,103+145*i,H-133)
text(36,H-60,'NOGGIN',35,GOLD,True)
text(37,H-83,'USE YOUR HEAD',14,WHITE,True)
text(37,H-110,f'{data["players"]["min"]}–{data["players"]["max"]} players  |  {data["boardSpaces"]}-space trapezium  |  Most Sparks after the final round wins',10,WHITE)

L=34;R=306;CW=254;y=H-159
# left column
ly=heading(L,y,'1  SET UP AND PLAY',CW)
steps=[
 'Open the TV host at /tv/ and show the lobby on your television.',
 'Scan its QR code with each phone; choose an untaken avatar and tap Ready.',
 'Each round, every player rolls once on their phone — all at once (Everyone Rolls, the default) or one at a time.',
 'Land on a coloured space to CALL that category for the round’s game — and host it. A later colour steals the call.',
 'The caller picks 1 of 2 games on their phone; then the whole panel plays it together.'
]
for i,s in enumerate(steps,1):
 text(L+3,ly,str(i)+'.',8.6,BLUE,True);ly=para(L+21,ly,s,CW-23,8.3,11.3);ly-=4
ly-=3
ly=heading(L,ly,'2  WIN SPARKS',CW)
# G10 (v3.5.0): payouts per game type, including the round-game bonus.
bonus=data["roundGameBonus"]
for s in [f'Round game: the host wins +{data["roundScore"]["hostWin"]}; any other winner +{data["roundScore"]["otherWinner"]}. A host who finishes last loses one Spark — but never when everyone ties.',
          f'Team games — Relay Sums (first team to finish) and Mind Meld (every matching pair): each winner +{1+bonus}.',
          f'Bomb Squad defused: everyone +{1+bonus}, host +{2+bonus}; if it blows up, the host loses one. Sketch & Sabotage: artist +{2+bonus} and first correct guesser +{1+bonus}; if nobody guesses, the secret saboteur +{2+bonus}.',
          f'Applause +{data["applause"]}. Pass Start +{data["bonusStart"]["pass"]}; land exactly on Start +{data["bonusStart"]["land"]}.',
          'LAST ORDERS: in the final round, every Spark you gain is doubled.',
          f'Showtime only — last place rolls two dice and picks one. Director’s Cut: start with {data["directorsCut"]["cues"]} Cues; nudge your landing by one space for 1 Cue. Win a contest or pass Start to earn 1 back (max 2).']:
 ly=para(L+8,ly,s,CW-13,7.8,10.5);ly-=3
ly-=1
ly=heading(L,ly,'3  THE UNDERDOG RULE',CW)
ly=para(L+8,ly,f'With four or more players, a mini-game or Showdown winner who started the turn {data["catchUp"]["threshold"]}+ Sparks behind the leader earns an extra {data["catchUp"]["extraSmall"]} Spark. In an eight-player match, the bonus is {data["catchUp"]["extraEight"]} Sparks.',CW-13,8.0,10.8);ly-=8
ly=heading(L,ly,'4  SPECIAL SPACES',CW)
for s in ['Wildcard — pick the round’s game, lock it so nobody can change it, and host it.', 'Steal the Call — you host this round’s game (unless a Wildcard has locked it).', 'Pickpocket — steal one Spark from the leader.', 'Brain Drain — answer in five seconds or lose one.', 'Stage Lift — jump across the stage to the other lift.']:
 ly=para(L+8,ly,s,CW-13,8.1,11.0);ly-=4
# right column
ry=heading(R,y,'THE 16 MINI-GAMES',CW)
colors={'speed':'#D74A68','brain':'#4184CD','create':'#CF9A2C','together':'#388D5B'}
for category,names in data['categories'].items():
 text(R+8,ry,category.upper(),9,HexColor(colors[category]),True);ry-=14
 ry=para(R+8,ry,'  •  '.join(names),CW-13,8.2,11.4);ry-=10
ry-=7
ry=heading(R,ry,'CORNER SHOWDOWNS',CW)
ry=para(R+8,ry,f'Every corner is a Showdown: pick a rival on your phone; the winner takes up to {data["showdownTransfer"]} Sparks. Buzzer Battle is first to 3. In Bid to Win the rival bids first. One Showdown per round — later corner landings that round earn +{data["cornerBonus"]}.',CW-13,8.4,11.8);ry-=10
for n in data['showdowns']:
 ry=tag(R+4,ry,n,CW-8)
ry-=8
ry=heading(R,ry,'GAME OVER',CW)
ry=para(R+8,ry,f'Most Sparks after the final round wins; a tie goes to a nearest-number Noggin-Off (one replay at most, then the first answer in wins). Auto length: {data["autoRounds"]["everyoneSmall"]} rounds (2–5 players) or {data["autoRounds"]["everyoneLarge"]} (6–8) with Everyone Rolls.',CW-13,8.6,12.5);ry-=14
ry=heading(R,ry,'PLAYING TOGETHER',CW)
ry=para(R+8,ry,'Discuss team clues aloud. Spectators can predict a Showdown winner: in Classic a correct pick earns +1 Spark if you are outside the top two; in Showtime it earns 1 Director Cue. Colour-blind safe mode swaps Colour Clash for Shape Clash. Two-player rooms skip '+', '.join(data['twoPlayerSkips'])+'.',CW-13,8.2,11.6)
# footer
footer=42
c.setStrokeColor(LIGHT);c.line(34,footer+25,W-34,footer+25)
text(36,footer+7,'One TV host + one phone per player. All 16 category games use the same room.',8.4,MUTE)
text(36,footer-7,'Generated from NOGGIN server modules — run tools/make-how-to-play.py after rules change.',7,MUTE)
assert min(ly,ry)>footer+15,(ly,ry)
c.showPage();c.save()
print(f'Wrote {OUT} ({data["boardSpaces"]} spaces, {sum(map(len,data["categories"].values()))} mini-games, one A4 page)')

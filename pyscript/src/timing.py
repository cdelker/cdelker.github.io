import asyncio
import random
from pyscript import display, when, web
from js import Uint8Array, File, URL
from io import BytesIO

from schemdraw import logic, Drawing

@when('input', '#timinginput')
def drawit(event):
    diagram_json = web.page["timinginput"].value
    try:
        d = logic.TimingDiagram.from_json(diagram_json)
        display(d, target='output', append=False)
    except:
        display('Error', target='output', append=False)


async def file_save(event):
    diagram_json = web.page["timinginput"].value
    with Drawing() as d:
        logic.TimingDiagram.from_json(diagram_json)
    img = d.get_imagedata()

    stream = BytesIO(img)
    js_array = Uint8Array.new(len(img))
    js_array.assign(stream.getbuffer())
    file = File.new([js_array], "schemdraw_timing.svg", {type: "text/plain"})
    url = URL.createObjectURL(file)

    hidden_link = web.a('img', download='schemdraw_timing.svg', href=url)
    hidden_link.click()


@when('click', '#randbutton')
def draw_random():
    diagram_input = web.page['timinginput']
    diagram_input.value = random.choice(examples)
    drawit(None)


drawit(None)

display('', target='loading', append=False)  # Clear loading message


examples = [
r'''{ signal: [
    { name: "Alfa", wave: "04.z1=ud.23.456789" }
]}
''',

r'''{ signal: [
  { name: "clk",         wave: "p.....|..." },
  { name: "Data",        wave: "x.345x|=.x", data: ["head", "body", "tail", "data"] },
  { name: "Request",     wave: "0.1..0|1.0" },
  {},
  { name: "Acknowledge", wave: "1.....|01." }
  ]}
''',

r'''{'signal': [
        {'name': 'A', 'wave': '0..1..01.', 'node': '...a.....'},
        {'name': 'B', 'wave': '101..0...', 'node': '.....b...'}],
     'edge': ['a~>b']
    }
''',

r'''{'signal': [
    {'name': 'clk', 'wave': 'P......'},
    {'name': 'J', 'wave': '0101', 'async': [0, .8, 1.3, 3.7, 7]},
    {'name': 'K', 'wave': '010101', 'async': [0, 1.2, 2.3, 2.8, 3.2, 3.7, 7]},
    {'name': 'Q', 'wave': '010.101', 'color': 'red', 'lw': 1.5},
    {'name': r'$\overline{Q}$', 'wave': '101.010', 'color': 'blue', 'lw': 1.5}],
'config': {'hscale': 1.5}}
''',

r'''{"signal": [
    {"name": "DTI_CLOCK", "wave": "01010101010101010101010101010101010101010101"},
    {"name": "DTI_CMD[0]", "wave": "x2.........2.2.............................x", "data": ["DES", "RD", "DES"]},
    {"name": "DTI_CMD[1]",       "wave": "x2.2.2....|................................x", "data": ["DES", "RD", "DES"]},
    {"name": "DTI_RDDATA_EN[0]", "wave": "0.........|....1...0...1...0................", "data": ["DES", "RD", "DES"]},
    {"name": "DTI_RDDATA_EN[1]", "wave": "0.........|....1...0.1...0..................", "data": ["DES", "RD", "DES"]},
    {"name": "DTI_RDDATA[0]",       "wave": "x2........|..................2.2.2...2.2.2.x", "data": ["", "D0", "D0", "", "D1", "D1"]},
    {"name": "DTI_RDDATA[1]",       "wave": "x2........|..................2.2.2.2.2.2...x", "data": ["", "D0", "D0", "", "D1", "D1"]},
    {"name": "DTI_RDDATA_VALID[0]", "wave": "0.........|..................1...0...1...0.."},
    {"name": "DTI_RDDATA_VALID[1]", "wave": "0............................1...0.1...0...."},
    {"name": "PHASE", "data": "{1 0}" },
    {},
    {"name": "PHY_PHY_CLOCK", "wave": "p..........................................."},
    {"name": "PHY_CMD",       "wave": "x2......22.....22..........................x", "data": ["DES", "RD", "DES", "RD", "DES"]},
    {"name": "PHY_RDDATA_EN", "wave": "0..............|..1...0..1...0.............."},
    {"name": "PHY_RDDATA",       "wave": "x2.............|..........22222...22222....x", "data": ["", "D0", "D0", "D0", "D0", "", "D1", "D1", "D1", "D1", ""]},
    {"name": "PHY_RDDATA_VALID", "wave": "0..............|..........1...0...1...0.....", "data": ["", "D0", "D0", "D0", "D0", "", "D1", "D1", "D1", "D1", ""]},
    {},
    {"name": "MEM_CK",    "wave": "Q..........................................."},
    {"name": "MEM_CMD",   "wave": "x2.........22.....22.......................x", "data": ["DES", "RD", "DES", "RD"]},
    {"name": "MEM_DQ",    "wave": "z..................|...bbbbz...bbbbz........", "data": ["0", "0", "0", "0", "0", "0", "0", "0", "1", "1", "1", "1", "1", "1", "1", "1"], "color": "blue"},
    {"name": "MEM_DQS/N", "wave": "z..................|..Q....z..Q....z........", "color": "blue"},
],
"shade": [
    "odd 0:9 #eee",
],
"edge": [
    "[0v:5]-[10v:5]{red}",
    "[2v:17]-[10v:17]{red}",
    "[10:5]<->[10:17]{red} tPHY_RDLAT=ROUNDDOWN((RL+CMD_PHASE)/2)",
    "[11^:5]<->[11^:9]{red} tCMDGEAR_DELAY",
    "[11^:9]-[16v:9]{red}",
    "[11^:17]<->[11^:19]{red} tDA",
    "[10:19]-[16v:19]{red}",
    "[15v:19]<->[15v:27]{red} tPHY_RDLAT",
    "[15^:27]-[16v:27]{red}",
    "[16:23]<->[16:27]{red} tPHY_RDVLD",
    "[16:23]-[20v:23]{red}",
    "[20^:23]<->[20^:12]{red} RL=19",
    "[20^:12]-[16^:12]{red}",
    "[16:12]<->[16:9]{red} tCTRL_DELAY",
    "[3^:17]->[13:18]{blue}",
    "[4^:23]->[13:25]{blue}",
    "[3^:23]-[4v:23]{red}",
    ],
"config": {"hscale": .75}
}
''',
]

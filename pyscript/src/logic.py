import asyncio
from pyscript import display, when, web
from js import Uint8Array, File, URL
from io import BytesIO

from schemdraw.parsing import logicparse


@when('input', '#expression')
@when('input', '#outlabel')
@when('input', '#height')
def drawit(event):
    expr = web.page['#expression'].value
    outlabel = web.page["#outlabel"].value
    gateH = float(web.page["#height"].value)
    d = logicparse(expr, outlabel=outlabel, gateH=gateH)
    display(d, target='schematic', append=False)

@when('click', '#savebutton')
async def file_save(event):
    expr = web.page['#expression'].value
    outlabel = web.page["#outlabel"].value
    gateH = float(web.page["#height"].value)
    img = logicparse(expr, outlabel=outlabel, gateH=gateH).get_imagedata()

    stream = BytesIO(img)
    js_array = Uint8Array.new(len(img))
    js_array.assign(stream.getbuffer())
    file = File.new([js_array], "schemdraw_logic.svg", {type: "text/plain"})
    url = URL.createObjectURL(file)

    hidden_link = web.a('img', download="schemdraw_logic.svg", href=url)
    hidden_link.click()


drawit(None)

display('', target='loading', append=False)  # Clear loading message

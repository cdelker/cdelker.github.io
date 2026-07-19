import asyncio
from pyscript import web, when, display
from js import Uint8Array, File, URL, console
from io import BytesIO

import ziamath

def getfont():
    name = web.page["#mathfont"].value
    return {'asana': 'Asana-Math.ttf',
            'concrete': 'Concrete-Math.otf',
            'dejavu': 'DejaVuMathTeXGyre.ttf',
            'erewhon': 'Erewhon-Math.otf',
            'fira': 'FiraMath-Regular.otf',
            'garamond': 'Garamond-Math.otf',
            'lete': 'LeteSansMath.otf',
            'liber': 'LibertinusMath-Regular.otf'
            }.get(name, None)  # stix is default/None





@when('input', '#expression')
@when('input', '#mathfont')
@when('click', '#inline')
def drawit(event):
    mathsvg = get_image()
    display(mathsvg, target='mathout', append=False)


def get_image():
    test = web.page["#mathml"]
    if test is not None:
        draw_func = ziamath.Math
        args = {}
    else:
        draw_func = ziamath.Latex
        args = {'inline': web.page["#inline"].checked}

    expr = web.page['#expression'].value
    try:
        mathsvg = draw_func(expr, font=getfont(), **args)
    except Exception as e:
        console.log('Math Exception: ' + str(e.args))
        return '...'
    return mathsvg


@when('click', '#savebutton')
async def file_save(event):
    #expr = web.page["#expression"].value
    #inline = web.page["#inline"].checked
    #mathsvg = ziamath.Latex(expr, font=getfont(), inline=inline).svg()
    mathsvg = get_image().svg()

    stream = BytesIO(mathsvg.encode('utf-8'))
    js_array = Uint8Array.new(len(mathsvg))
    js_array.assign(stream.getbuffer())
    file = File.new([js_array], "ziamath.svg", {type: "text/plain"})
    url = URL.createObjectURL(file)

    hidden_link = web.a('img', download='ziamath.svg', href=url)
    hidden_link.click()


drawit(None)
display('', target='loading', append=False)  # Clear loading message



import asyncio
from pyscript import web, when, display
from js import Uint8Array
from io import BytesIO

import ziafont


class MyFont:
    ''' Class for accessing loaded font globally '''
    def __init__(self):
        self.font = ziafont.Font()

    def change_font(self, fname):
        self.font = ziafont.Font(fname)


myfont = MyFont()


@when('change', '#fileinput')
async def load_font(event=None):
    ''' Load the font file '''
    files = event.target.files.to_py()
    file = files.item(0)
    if file is None: return
    filename = file.name
    content = Uint8Array.new(await file.arrayBuffer())
    buf = BytesIO(bytearray(content))
    with open(filename, 'wb') as f:
        f.write(buf.getbuffer())

    myfont.change_font(filename)
    drawfont()
    fill_gsub(None)
    fill_features()
    update_text(None)


def drawfont(*args):
    ''' Draw all glyphs and font info '''
    display(ziafont.inspect.ShowGlyphs(
        myfont.font, size=28, columns=16,
        ),
        target='out_allglyphs', append=False)
    display(ziafont.inspect.DescribeFont(myfont.font), target='out_fontinfo', append=False)


def drawglyph(*args):
    ''' Draw the glyph '''
    glyph = myfont.font.glyph('A')
    display(glyph.test(), target='out_oneglyph', append=False)
    display(ziafont.inspect.DescribeGlyph(glyph), target='out_glyphinfo', append=False)


@when('input', '#character')
def update_glyph_char(event=None):
    ''' Update the glyph by character '''
    c = web.page['#character'].value[-1]
    web.page['#character'].value = c
    glyph = myfont.font.glyph(c)
    display(glyph.test(), target='out_oneglyph', append=False)
    display(ziafont.inspect.DescribeGlyph(glyph), target='out_glyphinfo', append=False)
    web.page['#glyphid'].value = glyph.index


@when('input', '#glyphid')
def update_glyph_id(event=None):
    ''' Update the glyph by ID '''
    i = int(web.page['#glyphid'].value)
    glyph = myfont.font.glyph_fromid(i)
    display(glyph.test(), target='out_oneglyph', append=False)
    display(ziafont.inspect.DescribeGlyph(glyph), target='out_glyphinfo', append=False)
    if glyph.char:
        ch = list(glyph.char)[0]
    else:
        ch = ''
    web.page['#character'].value = ch


@when('click', '#out_allglyphs')
def glyph_click(event=None):
    ''' A glyph was clicked '''
    target = event.target
    while target.tagName != 'DIV':  # Traverse up to find the div that was clicked
        target = target.parentNode

    gid = target.getAttribute('gid')
    if gid:
        #glyph = myfont.font.glyph_fromid(int(gid))
        #display(glyph.test(), target='out_oneglyph', append=False)
        #display(ziafont.inspect.DescribeGlyph(glyph), target='out_glyphinfo', append=False)
        web.page['#glyphid'].value = int(gid)
        update_glyph_id(None)
        web.page['#oneglyph'].checked = True


def fill_gsub(event=None):
    ''' Fill GSUB feature dropdown '''
    sel = web.page['#feature']
    sel.length = 0  # Remove old options
    if not myfont.font.gsub:
        return
    features = list(myfont.font.gsub.features_available().keys())
    for feat in features:
        option = web.option(value=feat, text=feat)
        sel.append(option)


@when('click', '#feature')
def update_gsub(event=None):
    ''' Update the GSUB table '''
    if not myfont.font.gsub:
        return
    feat = web.page['#feature'].value
    display(
        ziafont.inspect.ShowFeature(
            feat,
            myfont.font,
            size=28
        ),
        target='out_gsub',
        append=False
    )


@when('input', '#textentry')
@when('input', '#textsize')
def update_text(event=None):
    text = web.page['#textentry'].value
    if not text:
        return

    size = int(web.page['#textsize'].value)

    features = web.page.find('.feature_check')
    if features:
        for feat in features:
            name = feat.name
            enabled = feat.checked
            myfont.font.features[name] = enabled

    display(
        myfont.font.text(text, size=size),
        target='out_text',
        append=False
    )


def fill_features(event=None):
    parent = web.page['#feature_chks']
    parent.innerHTML = ''
    features = myfont.font.features
    for name, checked in features.items():
        div = web.div()
        chk = web.input_(value=name, name=name, type='checkbox', classes=['feature_check'], checked=checked)
        when('click', chk)(update_text)

        label = web.label(name)
        div.append(chk)
        div.append(label)
        parent.append(div)


update_text(None)
fill_features(None)
fill_gsub(None)
drawfont()
drawglyph()

display('', target='loading', append=False)  # Clear loading message

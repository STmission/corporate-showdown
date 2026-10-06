"""Run with browser-use < prototype/tools/browser-smoke.py; requires npm start.
Tests real first-person entry, keyboard movement, escape menu and exit/re-entry.
"""
import json
import time
import base64
from pathlib import Path

new_tab('http://127.0.0.1:4173')
activate_tab(current_tab())
wait_for_load()
cdp('Emulation.setFocusEmulationEnabled', enabled=True)
registration = cdp('Page.addScriptToEvaluateOnNewDocument', source="""
window.__csTestInstalled = true;
window.__csErrors=[]; window.addEventListener('error', e=>window.__csErrors.push(e.message)); window.addEventListener('unhandledrejection',e=>window.__csErrors.push(String(e.reason))); 
const OriginalAudio = window.AudioContext;
window.AudioContext = class extends OriginalAudio {
 constructor(...args) { super(...args); window.__csTestAudio = this; }
};
const Original = window.WebSocket;
window.WebSocket = class extends Original {
 constructor(...args) { super(...args); this.addEventListener('message', e => {
   try { const f=JSON.parse(e.data); if(f.type==='joined')window.__csTestPlayer=f.playerId; if(f.state)window.__csTestState=f.state; } catch {}
 }); }
};
""")
cdp('Page.reload', ignoreCache=True)

def wait(check, timeout=30):
    end=time.monotonic()+timeout
    while time.monotonic()<end:
        try:
            if check(): return
        except RuntimeError as error:
            # A reload temporarily destroys the old execution context.
            # Retry only that navigation race; application/assertion failures propagate.
            if 'Inspected target navigated or closed' not in str(error) and 'Execution context was destroyed' not in str(error): raise
        time.sleep(.1)
    raise AssertionError('UI state not reached')

def visible(id):
    return js(f"!!document.querySelector('#{id}') && !document.querySelector('#{id}').classList.contains('hidden')")

def click(name):
    nodes=cdp('Accessibility.getFullAXTree')['nodes']
    n=next(n for n in nodes if n.get('role',{}).get('value')=='button' and n.get('name',{}).get('value')==name)
    cdp('DOM.scrollIntoViewIfNeeded',backendNodeId=n['backendDOMNodeId']);time.sleep(.2)
    q=cdp('DOM.getBoxModel',backendNodeId=n['backendDOMNodeId'])['model']['content']
    click_at_xy(sum(q[0::2])/4,sum(q[1::2])/4)

def state(): return json.loads(js('JSON.stringify(window.__csTestState || {})'))
def player(s): return next(p for p in s['players'] if p['id']==js('window.__csTestPlayer'))
def key(code,down): cdp('Input.dispatchKeyEvent',type='keyDown' if down else 'keyUp',code=code,key=code[-1].lower() if code.startswith('Key') else code)

a=Path('/Users/liuqi/Documents/ChatGPT/corporate-showdown/artifacts');a.mkdir(exist_ok=True)
def shot(name): (a/name).write_bytes(base64.b64decode(cdp('Page.captureScreenshot',format='png')['data']))
try:
    wait(lambda: js('window.__csTestInstalled') is True)
    wait(lambda: js("document.querySelector('#connection')?.textContent")=='服务已连接')
    wait(lambda: js("!document.querySelector('#solo').disabled"), timeout=60)
    assert js('window.gameDiagnostics().environmentLoaded') is True
    assert len(js('window.gameDiagnostics().humanTemplates'))>=2
    shot('first-person-home.png')
    click('开始单人行动 ↗')
    wait(lambda: visible('help') or state().get('status')=='running')
    if state().get('status')!='running': click('进入办公室 →')
    wait(lambda: visible('hud') and state().get('status')=='running')
    wait(lambda: js('window.__csTestAudio?.state')=='running')
    wait(lambda: len(js('window.gameDiagnostics().actors'))>=5)
    assert js('window.__csErrors')==[], js('window.__csErrors')
    start_frame=js('window.gameDiagnostics().render.frame')
    first=state()['id'];before=player(state())['z']
    key('KeyW',True);time.sleep(.65);key('KeyW',False)
    wait(lambda: player(state())['z']<before-1)
    bounds=json.loads(js("JSON.stringify((()=>{const r=document.querySelector('#scene canvas').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})())"))
    click_at_xy(bounds['x'],bounds['y'])
    wait(lambda: js('!!document.pointerLockElement'))
    cdp('Input.dispatchMouseEvent',type='mouseMoved',x=bounds['x']+120,y=bounds['y'])
    wait(lambda: abs(player(state())['fx'])>0.05)
    assert js('window.gameDiagnostics().render.frame')>start_frame+2
    assert js('window.__csErrors')==[], js('window.__csErrors')
    shot('first-person-gameplay.png')
    key('Escape',True);key('Escape',False)
    wait(lambda: visible('pause-menu'))
    shot('first-person-menu.png')
    click('退出行动 · 返回大厅')
    wait(lambda: visible('home'))
    assert not visible('hud')
    click('开始单人行动 ↗')
    wait(lambda: state().get('id') != first and (visible('help') or state().get('status')=='running'))
    assert state()['id']!=first
    if visible('help'): click('取消行动，返回大厅')
    else:
        key('Escape',True);key('Escape',False);wait(lambda:visible('pause-menu'));click('退出行动 · 返回大厅')
    wait(lambda:visible('home'))
    print(json.dumps({'headquarters_loaded':'passed','rigged_character_templates':len(js('window.gameDiagnostics().humanTemplates')),'continuous_rendering':'passed','page_errors':0,'first_person_entry':'passed','forward_movement':'passed','mouse_look':'passed','audio_context':'running','escape_menu':'passed','return_home':'passed','reentry':'passed'},ensure_ascii=False))
finally:
    key('KeyW',False)
    cdp('Page.removeScriptToEvaluateOnNewDocument',identifier=registration['identifier'])
    cdp('Emulation.setFocusEmulationEnabled',enabled=False)

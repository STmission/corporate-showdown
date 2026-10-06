"""Run using browser-use; verify wardrobe rendering and room revision gating in a real browser."""
import json,time,base64
from pathlib import Path
new_tab('http://127.0.0.1:4173')
# Chrome ignored compositor clicks while this test tab was in the background.
activate_tab(current_tab())
wait_for_load()
cdp('Emulation.setFocusEmulationEnabled',enabled=True)
registration=cdp('Page.addScriptToEvaluateOnNewDocument',source="""
window.__wardrobeInstalled=true;window.__wardrobeErrors=[];addEventListener('error',e=>window.__wardrobeErrors.push(e.message));addEventListener('unhandledrejection',e=>window.__wardrobeErrors.push(String(e.reason)));
const BaseWS=WebSocket;window.WebSocket=class extends BaseWS{constructor(...args){super(...args);window.__wardrobeSocket=this;this.addEventListener('message',e=>{const f=JSON.parse(e.data);if(f.type==='joined')window.__wardrobeId=f.playerId;if(f.state)window.__wardrobeState=f.state;});}};
""")
cdp('Page.reload',ignoreCache=True)
wait_for_load()
def wait(check,timeout=45):
 end=time.monotonic()+timeout
 while time.monotonic()<end:
  if check():return
  time.sleep(.15)
 raise AssertionError('wardrobe state not reached: '+str(js('JSON.stringify({errors:window.__wardrobeErrors,state:window.__wardrobeState,diag:window.gameDiagnostics?.()})')))
def click(name):
 wait(lambda:js("[...document.querySelectorAll('button')].some(e=>e.textContent.trim()==="+json.dumps(name)+"&&!e.disabled)"))
 # Run the actual UI handler. Focus/scroll compositor delivery was inconsistent in this local Chrome session.
 js("(()=>{const e=[...document.querySelectorAll('button')].find(e=>e.textContent.trim()==="+json.dumps(name)+");if(!e||e.disabled)throw new Error('Button unavailable');e.click();})()")
def select(name,last):
 # Native select popups do not accept synthetic End/Home consistently on macOS.
 # Dispatch the same change event in this project's DOM, then verify the resulting server state.
 field='lobby-gender' if name=='人物' and js("!document.querySelector('#lobby').classList.contains('hidden')") else 'gender' if name=='人物' else 'lobby-job' if js("!document.querySelector('#lobby').classList.contains('hidden')") else 'job'
 js("(()=>{const el=document.getElementById("+json.dumps(field)+");el.selectedIndex="+('el.options.length-1' if last else '0')+";el.dispatchEvent(new Event('change',{bubbles:true}));})()")
try:
 wait(lambda:js("window.__wardrobeInstalled===true && !!window.gameDiagnostics && typeof document.querySelector('#create')?.onclick==='function' && document.querySelector('#solo')?.disabled===false && document.querySelector('#connection')?.textContent==='服务已连接'"))
 select('人物',True);select('职务装扮',True)
 assert js("document.querySelector('#gender').value")=='female'
 assert js("document.querySelector('#job').value")=='celebrity'
 click('创建合作房间')
 wait(lambda:js('window.__wardrobeState?.status')=='lobby')
 wait(lambda:js("document.querySelector('#ready').disabled") is False)
 assert js('window.__wardrobeState.players[0].job')=='celebrity'
 wait(lambda:'female_celebrity' in js('window.gameDiagnostics().visibleActors'))
 Path('/Users/liuqi/Documents/ChatGPT/corporate-showdown/artifacts/wardrobe-room-preview.png').write_bytes(base64.b64decode(cdp('Page.captureScreenshot',format='png')['data']))
 # Exercise every approved model via the room protocol; browser must load and render each.
 for gender in ['male','female']:
  for job in ['programmer','ecommerce','sales','celebrity']:
   slot=gender+'_'+job
   js("(()=>{document.getElementById('lobby-gender').value="+json.dumps(gender)+";const s=document.getElementById('lobby-job');s.value="+json.dumps(job)+";s.dispatchEvent(new Event('change'));})()")
   wait(lambda:js('window.__wardrobeState.players[0].gender')==gender and js('window.__wardrobeState.players[0].job')==job)
   wait(lambda:slot in js('window.gameDiagnostics().visibleActors'))
   wait(lambda:js("document.querySelector('#ready').disabled") is False)
 click('我准备好了')
 wait(lambda:js('window.__wardrobeState.players[0].ready') is True)
 old=js('window.__wardrobeState.loadoutRevision')
 select('职务装扮',False)
 wait(lambda:js('window.__wardrobeState.loadoutRevision')>old)
 assert js('window.__wardrobeState.players[0].ready') is False
 wait(lambda:js("document.querySelector('#ready').disabled") is False)
 click('我准备好了');wait(lambda:js('window.__wardrobeState.players[0].ready') is True)
 click('全员出发 →');click('进入办公室 →')
 wait(lambda:js('window.__wardrobeState.status')=='running')
 wait(lambda:js('window.gameDiagnostics().firstPersonAppearance')=='female_programmer')
 assert js('window.__wardrobeErrors')==[],js('window.__wardrobeErrors')
 Path('/Users/liuqi/Documents/ChatGPT/corporate-showdown/artifacts/wardrobe-first-person.png').write_bytes(base64.b64decode(cdp('Page.captureScreenshot',format='png')['data']))
 cdp('Input.dispatchKeyEvent',type='keyDown',key='Escape',code='Escape');cdp('Input.dispatchKeyEvent',type='keyUp',key='Escape',code='Escape')
 wait(lambda:js("!document.querySelector('#pause-menu').classList.contains('hidden')"));click('退出行动 · 返回大厅')
 print(json.dumps({'outfits_rendered':8,'lobby_switch_reset_ready':'passed','selected_first_person':'female_programmer','page_errors':0}))
finally:
 cdp('Page.removeScriptToEvaluateOnNewDocument',identifier=registration['identifier']);cdp('Emulation.setFocusEmulationEnabled',enabled=False)

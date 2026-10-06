// Generated from prototype/shared/story.mjs; run sync:cocos.
export const STORY_REVISION='story-v0.3';
export const STORY_NPCS=Object.freeze([
 {id:'teacher',name:'许老师',profession:'老师',gender:'female',job:'programmer',x:-20,z:5.8,habit:'讲解',topics:[{id:'schedule',label:'这份加班名单怎么回事？',text:'先别急，咱们把题审清楚。系统把明天的演讲彩排，排成了今晚的全员加班。原始日程在老师这儿，拿去对照。',clue:'schedule'},{id:'comfort',label:'我今天有点绷不住了。',text:'允许自己停一下。这不是考试，你也不用每一分钟都满分。先去海景休息区坐坐。'}]},
 {id:'lawyer',name:'顾律师',profession:'律师',gender:'male',job:'sales',x:-6.4,z:.6,habit:'查阅文件',topics:[{id:'policy',label:'想拿回自己的下班时间。',text:'咱们先讲证据，再讲诉求。这份公司休假制度，和今晚的名单对不上。把原始日程、制度和审批记录放到一起，去会议室当面说清楚。',clue:'policy'},{id:'reason',label:'证据齐了，能和平解决吗？',text:'材料齐了。你负责把问题讲清楚，我帮你把流程理顺。我们去把错误安排撤回，今晚大家都能走。',requires:['schedule','policy','ledger'],route:'reason'}]},
 {id:'doctor',name:'林医生',profession:'医生',gender:'female',job:'ecommerce',x:0,z:-9,habit:'整理急救包',topics:[{id:'rest',label:'能让我缓一缓吗？',text:'当然。先坐稳，喝点水，别硬扛。这里是故事里的休息点，不是新的打卡任务。',heal:20},{id:'where',label:'还有谁知道这事？',text:'先把呼吸缓下来，咱们按手头的材料核对。'}]},
 {id:'finance',name:'周姐',profession:'金融／财务',gender:'female',job:'sales',x:0,z:-17,habit:'核对报表',topics:[{id:'ledger',label:'查一下今晚的审批记录。',text:'这账不对。彩排预算有，今晚的加班审批没有。别让一句“辛苦一下”把两件事混成一件事。审批记录给你了。',clue:'ledger'},{id:'challenge',label:'证据齐了，去当面质询。',text:'好，材料在手，心里有底。去演讲区把这套离谱流程拆开讲。你也可以回去找顾律师，走协商路线。',requires:['schedule','policy','ledger'],route:'challenge'}]},
 {id:'veteran',name:'退役教官老程',profession:'退役特种兵',gender:'male',job:'ecommerce',x:-7,z:-1,habit:'观察通道',topics:[{id:'route',label:'有什么行动建议？',text:'先观察，再行动。别把路堵死，别追着一个目标跑。工位区有绕行通道，茶水间能补给；看见蓄力预警就换位置。',clue:'route'}]},
 {id:'poet',name:'诗人白先生',profession:'诗人',gender:'male',job:'celebrity',x:-7,z:5.8,habit:'即兴吟诗',topics:[{id:'verse',label:'来一句下班宣言。',text:'此身不是待办项，海风才是下一章。诗写到这儿，咱就不再给会议续杯了。',clue:'verse'}]},
]);
export function newStory(){return {revision:STORY_REVISION,phase:'explore',chapter:'第一章 · 谁把假期改成了待办',clues:[],choices:[],deadline:null,dialogue:null,route:null};}
export function nearestStoryNpc(state,player){return state?.npcs?.filter(n=>Math.hypot(n.x-player.x,n.z-player.z)<2.3).sort((a,b)=>Math.hypot(a.x-player.x,a.z-player.z)-Math.hypot(b.x-player.x,b.z-player.z))[0]??null;}

// Server uses these stations; destinations remain inside the approved floor.
export const NPC_ROUTINES=Object.freeze({
 teacher:[{x:-20,z:5.8,activity:'核对演讲日程',seconds:20},{x:-20,z:7,activity:'查看工位安排',seconds:12},{x:-18.8,z:7,activity:'整理彩排笔记',seconds:12}],
 lawyer:[{x:-6.4,z:.6,activity:'查阅公司制度',seconds:18},{x:-7,z:.6,activity:'核对签字文件',seconds:14},{x:-7,z:2,activity:'整理协商材料',seconds:14}],
 doctor:[{x:0,z:-9,activity:'整理急救包',seconds:16},{x:0,z:-7,activity:'检查休息通道',seconds:14},{x:0,z:-11,activity:'清点急救物资',seconds:18}],
 finance:[{x:0,z:-17,activity:'核对审批报表',seconds:18},{x:0,z:-15,activity:'复查预算记录',seconds:14},{x:0,z:-18,activity:'整理报销文件',seconds:16}],
 veteran:[{x:-7,z:-1,activity:'观察办公通道',seconds:14},{x:-7,z:-3,activity:'检查绕行路线',seconds:14},{x:-7,z:1,activity:'留意电梯入口',seconds:16}],
 poet:[{x:-7,z:5.8,activity:'琢磨下班诗句',seconds:16},{x:-7,z:7,activity:'寻找灵感',seconds:14},{x:-8,z:7,activity:'写下海风随笔',seconds:16}],
});
export function nextClueHint(story){return !story.clues.includes('schedule')?'先找工位区的许老师，核对原始日程。':!story.clues.includes('policy')?'再找电梯西侧的顾律师，问清公司制度。':!story.clues.includes('ledger')?'去中央休息区北端找周姐，对照审批记录。':story.phase==='explore'?'三份材料都齐了。找顾律师协商，或找周姐发起质询。':story.phase==='resolved'?(story.route==='reason'?'安排已经撤回，前往电梯长按 E 离开。':'组长的阻拦已解除，前往电梯长按 E 撤离；别再恋战。'):'质询已开始，完成现场交接，再应对组长的阻拦。';}

export function storyTopicAvailable(story,topic){return !topic.requires?.some(clue=>!story.clues.includes(clue))&&(!topic.route||!story.route||topic.route===story.route);}
const AFTER_RESOLUTION={
 teacher:'日程已经核对清楚了。今天的你不用交一份“永远在线”的满分答卷，去把自己的晚上领回来。',
 lawyer:'错误安排已经撤回，材料也留好了。诉求讲清楚，比一直憋着有效。电梯已开放，剩下的路你自己选。',
 doctor:'休息不用再申请了。别把下班也做成另一项考核，今晚给自己留点空白。',
 finance:'账对上了，彩排归彩排，加班归加班。今晚的时间不再混进那张表。',
 veteran:'出口已经打开。别恋战，确认通道，走出去才是这次行动的最后一步。',
 poet:'待办到此为止，海风另起一行。电梯门一开，今晚就不再押“收到”的韵。',
};
export function storyDialogueText(story,npc,topic,hint){
 if(topic.id==='where')return (story.phase==='resolved'?AFTER_RESOLUTION[npc.id]:topic.text)+' '+hint;
 if(story.phase==='resolved')return AFTER_RESOLUTION[npc.id];
 if(story.phase==='challenge'&&topic.route)return '质询已经开始，材料不会重置。先完成现场交接，留意组长的蓄力预警，电梯是最后的目标。';
 if(story.phase==='challenge'&&topic.id==='rest')return '先到安全的位置缓一缓，别硬扛。休息点只恢复一次，不需要付费；别忘了给撤离留时间。';
 return topic.text;
}
export function storyEnding(story,success,reason){
 const id=success?story.route==='reason'?'reason':'challenge':reason==='timeout'?'timeout':reason==='team_down'?'down':'left';
 const endings={
 reason:{title:'把晚上还给自己',summary:'三份证据让错误安排被撤回。你没有给这场误会加一场仗，电梯门外是属于自己的时间。'},
 challenge:{title:'这场会，到此结束',summary:'你带着证据当面质询，完成交接并突破组长的阻拦。离谱流程没有拖住你的脚步，今晚不再续会。'},
 timeout:{title:'迟到的是流程，不是你的价值',summary:'这次没赶上电梯，查到的事实仍然有意义。下次给交接和撤离留出时间，别把一场失败当成对自己的判决。'},
 down:{title:'今天先到这里',summary:'行动暂时停下了。先留意招式预警、绕行通道和免费的自救，再决定下一次怎么走。'},
 left:{title:'这次行动先收起来',summary:'这次还没有完成撤离。离开一场行动，不等于必须一直留在一份待办里。'},
 };
 const voices=[{npcId:'teacher',name:'许老师',text:success?'题目审清了，今晚不加一道附加题。':'这不是一次给你打分的考试。'}];
 if(story.choices.includes('doctor:rest'))voices.push({npcId:'doctor',name:'林医生',text:'你愿意停下来照顾自己，这一步也算数。'});
 if(story.clues.includes('verse'))voices.push({npcId:'poet',name:'白先生',text:'此身不是待办项，海风才是下一章。'});
 return {id,...endings[id],voices,evidence:story.clues.filter(c=>['schedule','policy','ledger'].includes(c)),selfCare:story.choices.includes('doctor:rest'),declaration:story.clues.includes('verse')};
}

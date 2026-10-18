import { grow, MORE, MORE2, RANDOM as RAND } from './thought-lines.more.js';
// Naman's own voice for the thought bubble (English only). Same exports as site/src/thought-lines.js, plus DAY_THOUGHTS,
// ACT_LINES (current act, any act) and TIME_LINES (hour of day). Written from the patterns in his Instagram export:
// lowercase, short, no end punctuation, "im / dont / thats", "abt / rn / js / idk / ur", rare emoji, stretched "yeaah".
// Original lines in his habits and themes, not quotes from his messages.
export const NEED_LINES = {
  hunger: ["should eat something rn", "my stomach is running the show", "tea isnt food naman", "ok i actually need to eat"],
  energy: ["so tired idk how im sitting up", "eyes barely open", "need to lie down soon", "everything feels heavy rn"],
  fun: ["bored. tell me something", "all work no play and its showing", "i need something fun, anything", "nothing is hitting rn"],
  social: ["wonder who's up rn", "should call someone", "too long without talking to a human", "its quiet. too quiet"],
  focus: ["cant hold one thought for long", "head is all over the place", "need a clear head first", "my brain has 40 tabs open"],
  hygiene: ["i could use a wash tbh", "feeling a bit grimy", "a hot shower would fix a lot"],
  bladder: ["ok i really need the loo", "cant put this off any longer"],
};
export const NEED_FIX = { hunger: 'eat', energy: 'sleep', fun: 'tv', social: 'phone_call', hygiene: 'shower', bladder: 'loo' };

export const EMOTION_LINES = {
  calm: ["nothing to prove rn", "quiet in here. good", "ok this is nice"],
  content: ["good day so far tbh", "this is enough", "feels like a chapter completed"],
  joyful: ["today feels light", "last few days were genuinely so good", "i could stay in this mood"],
  delighted: ["wait that was actually nice", "didnt see that coming, in a good way", "ooh okay"],
  curious: ["what if i tried it differently?", "huh. thats interesting", "wonder how that works"],
  absorbed: ["dont break the flow", "lost track of time again", "js five more minutes of this"],
  bored: ["nothing is happening", "i keep checking the time", "wake me when something happens"],
  restless: ["cant sit still", "keep getting up and sitting down", "need to move or make something"],
  anxious: ["too many things in my head", "what if it all falls apart?", "overthinking again, i know"],
  uneasy: ["something feels off", "cant tell what, but something does"],
  frustrated: ["why wont this just work", "ok. breathe. try again", "i dont even know abt this anymore"],
  sad: ["a low one. it'll pass", "js let it be heavy for a bit", "wanna drown in music for a while"],
  lonely: ["wish someone would drop by", "the room is big when its quiet", "i dnt belong anywhere rn, its fine"],
  proud: ["ok that came out well", "i made that. not bad", "okay okay, im kinda good"],
  relieved: ["phew. thats done", "finally off my mind"],
  drowsy: ["eyes getting heavy", "just five more minutes"],
  dazed: ["running on fumes", "everything is a bit far away"],
  nostalgia: ["this reminds me of an older room", "funny what a song brings back"],
  awe: ["wow. js look at that", "stopped in my tracks"],
  aesthetic_appreciation: ["the colours in this are so good", "beautiful, quietly"],
  amusement: ["trying not to laugh at myself", "that was kinda funny lol"],
  triumph: ["yesss i did the thing", "thats one for the wall"],
  given_up: ["done for now. its fine", "tomorrow maybe"],
  embarrassed: ["pretend you didnt see that", "ok nobody saw that"],
};

export const NEXT_LINES = {
  tea: "then tea", eat: "then food", cook: "then ill cook something", fridge: "then check the fridge",
  sleep: "then bed", nap_bench: "then a nap on the bench", shower: "then a shower", night_shower: "then a shower", brush: "then brush my teeth", wash: "then wash up",
  loo: "then the loo", work: "then back to the desk", work_through: "then back to the desk", keys: "then some keys", guitar: "then the guitar",
  records: "then a record", tv: "then some tv", read: "then a few pages", window: "then the window for a bit", snake: "then say hi to the snake",
  water_plant: "then water the plant", art_sketch: "then sketch something", art_refine: "then back to the painting", art_render: "then render it", art_review: "then a hard look at it",
  phone_call: "then call someone", write_letter: "then write a letter", gallery_view: "then look at some art", dress: "then get dressed", roam: "then wander a bit", pace: "then pace it out",
};

// the same keys as DAY_THOUGHTS in thoughts.js, said his way
export const DAY_THOUGHTS = {
  tea: ["cant start anything without tea", "ginger tea hits js right", "warm mug, quiet room", "two more mins of steeping"],
  cook: ["something quick and simple", "ordering would be faster but cooking is nice", "salt looks right", "yeah this smells good"],
  eat: ["quiet meals are underrated", "comfort food never fails", "ten mins to just sit and eat"],
  plant: ["it has a new leaf, look at u", "dont overwater it naman", "a bit of green in here"],
  easel: ["needs more magenta in the shadows", "doodling is pure therapy", "pixels, paint, synths. same thing different speed", "i think this one wants to be weirder"],
  work: ["one more commit then a break", "if it compiles first time im suspicious", "fixing the node graph again", "i need to ship this abt infinite"],
  keys: ["what if the tempo drops to 110 here?", "that chord gives me goosebumps", "lemme try a sub bassline", "analog warmth hits different"],
  guitar: ["fingers getting calloused again", "this riff has been stuck in my head all week", "acoustic sounds nice in here"],
  records: ["which record next?", "vinyl crackle is comforting", "radiohead again? ofc"],
  fridge: ["anything sweet in here?", "need groceries soon", "cold water, yeah"],
  snake: ["no thoughts in that head. i envy it", "who keeps who?", "curled up in the spiral again"],
};

// whatever act he is doing now (any act id); thoughts.js can fall back to this when DAY_THOUGHTS has nothing
export const ACT_LINES = {
  tv: ["watching on 2x, dont judge", "one more episode then i stop", "idk this show is kinda good"],
  read: ["a few pages and my head clears", "this book is making me think abt everything", "reading > scrolling, i keep saying that"],
  window: ["people coming and going, always", "the sky does this thing at this hour", "just looking. nothing else"],
  shower: ["best thinking happens here", "hot water fixes a lot"],
  night_shower: ["washing the day off", "hot water, then bed"],
  brush: ["teeth. adult life.", "almost bed"],
  wash: ["cold water on my face, ok"],
  sleep: [],
  nap_bench: [],
  loo: [],
  dress: ["what even is a personality in clothes", "black again, ok"],
  roam: ["walking in circles counts as thinking", "needed to move a bit"],
  pace: ["pacing helps me think. i think", "ok ok ok"],
  phone_call: ["yeah, tell me everything"],
  write_letter: ["words come out different with a pen", "idk who this is for yet"],
  gallery_view: ["i want to make something like this", "my own taste surprises me sometimes"],
  water_plant: ["growing slowly. same"],
  art_sketch: ["rough first, then it gets honest", "lines first, feelings later"],
  art_refine: ["almost there, dont ruin it", "one more pass and then i stop. maybe"],
  art_render: ["come on infinite, do your thing", "waiting on the render, tea?"],
  art_review: ["is it good or do i just like it", "ok be honest naman"],
  keys: ["a little loop and see where it goes"],
  work_through: ["still at it. its fine", "deep in it, dont talk to me lol"],
};

// by hour of the day (IST), picked now and then so the bubble also sounds like the time of day
export const TIME_LINES = {
  late_night: ["its late. i know. one more thing", "the best ideas show up after midnight", "everyone is asleep and i feel awake", "should sleep. wont, yet"],      // 00-05
  morning: ["slow start, thats ok", "tea first, then the world", "new day, same room, lets see"],                                                              // 05-11
  afternoon: ["afternoon slump is real", "sun is so bright outside rn", "scroll a little, then work. promise"],                                                // 11-17
  evening: ["evening is when i feel most like myself", "this is the hour i write the most", "feeling talkative tonight", "music hits different at this hour"],  // 17-24
};
export const hourBucket = h => h < 5 ? 'late_night' : h < 11 ? 'morning' : h < 17 ? 'afternoon' : 'evening';

// small things he does a lot (phone, scrolling, comfort): optional extras for the phone/scroll acts
export const SCROLL_LINES = ["js one more reel", "my algo knows me too well", "why am i still scrolling", "saved it. will never watch it again", "ok phone down. phone down. phone down"];
export const SELF_LINES = ["im trynna be better abt this", "i feel like i outgrew something and cant name it", "being alone is getting comforting", "i dont wanna talk abt work today", "music is the only thing that makes sense rn"];

grow({ NEED_LINES, EMOTION_LINES, DAY_THOUGHTS, ACT_LINES, TIME_LINES, SCROLL_LINES, SELF_LINES }, MORE);
grow({ DAY_THOUGHTS, ACT_LINES }, MORE2);
export const RANDOM_LINES = RAND;

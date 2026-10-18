import { grow } from './thought-lines.more.js';
import { MORE, MORE2, RANDOM as RAND, MEET } from './her-thought-lines.more.js';
// Thought bubble lines for the second character ("her"), English only. Same exports as the voice file made for Naman
// (thought-lines.voice.js). Original lines in her habits: lowercase, short, u/ur/v/alr/smthn/bec/abt, one 😭 now and then,
// stretched hmmm/ohhh/achaaa. Not quotes from anyone's messages. Emoji appear in about 1 line in 8.
export const NEED_LINES = {
  hunger: ["ok i need to eat properly today", "ive been eating so badly lately 😭", "snack first, then think", "why am i so hungry again"],
  energy: ["so tired. i slept and im still tired", "hmmm my eyes wont stay open", "need to lie down for a bit", "everything feels slow today 😭"],
  fun: ["bored. send me smthn", "i need smthn fun to watch", "nothing is interesting rn", "ok what do i even do now"],
  social: ["wonder who's free to talk", "should i call someone", "its quiet. maybe a call?", "i miss talking to ppl a bit"],
  focus: ["cant focus at all", "my brain is not here today", "starting things is so hard for me", "ok just one tiny step"],
  hygiene: ["i need a long shower", "feeling so hazy, shower time", "a shower would fix a lot"],
  bladder: ["ok i really need the loo", "cant hold this any longer"],
};
export const NEED_FIX = { hunger: 'eat', energy: 'sleep', fun: 'tv', social: 'phone_call', hygiene: 'shower', bladder: 'loo' };

export const EMOTION_LINES = {
  calm: ["its v quiet. good", "okay this is nice", "nothing to do and thats fine"],
  content: ["good day so far", "i feel okay today", "this is enough for now"],
  joyful: ["omg today feels good", "im in such a good mood", "ok i like this day"],
  delighted: ["wait that was so nice", "oh i didnt expect that", "okay that made my day"],
  curious: ["hmmm what if i tried that?", "achaaa so thats how it works", "wait now i wanna know more"],
  absorbed: ["dont talk to me, im in the zone", "lost track of time again", "okay just a bit more"],
  bored: ["nothing is happening", "i keep checking my phone", "hmmm what now"],
  restless: ["cant sit still", "i keep getting up for no reason", "i need to do smthn"],
  anxious: ["what if it goes wrong", "ive been overthinking all day", "ok breathe"],
  uneasy: ["smthn feels off", "cant tell what, but it does"],
  frustrated: ["why is this so annoying", "okay. i'll try again", "ugh. one more time"],
  sad: ["a low day. it'll pass 😔", "just want to lie down for a bit", "hmmm im not okay but its fine"],
  lonely: ["wish someone would call", "the room feels too big", "i could use a chat rn"],
  proud: ["okay i did that. not bad", "look at me being productive", "alr i feel good about this"],
  relieved: ["phew. finally done", "ok that's off my mind"],
  drowsy: ["so sleepy", "five more minutes. maybe ten"],
  dazed: ["running on nothing rn", "everything feels a bit far away"],
  nostalgia: ["this reminds me of college", "funny what a song brings back"],
  awe: ["wow. look at that", "omg okay"],
  aesthetic_appreciation: ["the colours are so pretty", "okay thats really nice"],
  amusement: ["im laughing at nothing 🤣", "okay that was funny", "trying not to laugh"],
  triumph: ["yesss i did it", "ok one thing done"],
  given_up: ["done for today", "tomorrow maybe"],
  embarrassed: ["ok nobody saw that 😭", "pretend that didnt happen"],
};

export const NEXT_LINES = {
  tea: "then tea", eat: "then food", cook: "then ill make smthn", fridge: "then check the fridge",
  sleep: "then bed", nap_bench: "then a nap", shower: "then a long shower", night_shower: "then a shower", brush: "then brush my teeth", wash: "then wash up",
  loo: "then the loo", work: "then back to work", work_through: "then back to work", keys: "then some music", guitar: "then some music",
  records: "then a record", tv: "then watch smthn", read: "then read a bit", window: "then look outside for a bit", snake: "then say hi to the snake",
  water_plant: "then water the plant", art_sketch: "then sketch a little", art_refine: "then back to it", art_render: "then wait for it", art_review: "then look at it again",
  phone_call: "then call someone", write_letter: "then write smthn", gallery_view: "then look at some art", dress: "then get dressed", roam: "then wander a bit", pace: "then pace a bit",
};

export const DAY_THOUGHTS = {
  tea: ["tea first. always", "warm cup, quiet room", "hmmm a bit more sugar", "this is my favourite part of the day"],
  cook: ["ill make smthn quick", "okay this smells good", "not cooking again 😭 but ok", "salt, then taste"],
  eat: ["eating properly for once", "comfort food hits different", "ten mins to just sit and eat"],
  plant: ["it looks happy today", "dont overwater, ok", "a bit of green is nice"],
  easel: ["hmmm this needs more colour", "okay thats actually pretty", "i like where this is going"],
  work: ["one more email then a break", "ill leave a bit earlier today", "meetings meetings meetings 😭", "ok just finish this and stop"],
  keys: ["i like this sound", "wait that chord is nice", "ok one more try"],
  guitar: ["fingers sore but ok", "this song is stuck in my head", "alr one more time"],
  records: ["which one next?", "love the crackle", "this is so cosy"],
  fridge: ["is there anything sweet", "need to restock soon", "just water, ok"],
  snake: ["so calm. i envy it", "hi hi", "curled up and happy"],
};

export const ACT_LINES = {
  tv: ["just one more episode", "watching smthn dumb and its great", "i have been on this show forever"],
  read: ["a few pages and my head clears", "ok this book is good"],
  window: ["people watching is the best", "it looks nice outside", "just looking, nothing else"],
  shower: ["best thinking happens here", "long shower, finally", "hot water fixes everything"],
  night_shower: ["washing the day off", "shower then bed"],
  brush: ["teeth then bed", "almost sleeping"],
  wash: ["cold water on my face"],
  sleep: [],
  nap_bench: [],
  loo: [],
  dress: ["what do i even wear", "okay good enough"],
  roam: ["walking around helps", "need to move a bit"],
  pace: ["pacing helps me think", "okay okay okay"],
  phone_call: ["omg wait let me tell u", "hmmm tell me everything"],
  write_letter: ["words come out different when i write", "idk who this is for"],
  gallery_view: ["so pretty", "i want to make smthn like this"],
  water_plant: ["growing slowly. same"],
  art_sketch: ["rough first, pretty later", "just play around"],
  art_refine: ["almost there", "one more pass and then i stop"],
  art_render: ["come on, do ur thing", "waiting waiting waiting"],
  art_review: ["is it good or do i just like it", "ok be honest"],
  keys: ["a little loop and see where it goes"],
  work_through: ["still working, its fine", "deep in it, dont disturb"],
};

// by hour of the day (IST)
export const TIME_LINES = {
  late_night: ["its late and im still up 😭", "okay i should sleep. soon", "midnight thoughts again", "everything is quiet now"],       // 00-05
  morning: ["so sleepy, hmmm", "ok slow start today", "tea, then the world", "five more minutes, always"],                          // 05-11
  afternoon: ["afternoon slump is real", "ok lets get through the day", "lunch? maybe lunch", "why is it so long today"],             // 11-17
  evening: ["finally the day is done", "i feel chatty tonight", "okay time to unwind", "audio call? maybe"],                          // 17-24
};
export const hourBucket = h => h < 5 ? 'late_night' : h < 11 ? 'morning' : h < 17 ? 'afternoon' : 'evening';

export const SCROLL_LINES = ["omg i have to send this to someone", "ok one more reel", "why is my feed so accurate", "saving this for later", "phone down. ok phone down"];
export const SELF_LINES = ["starting things is the hard part", "im v bad at doing nothing", "i think im more of an introvert than i admit", "i need to be nicer to myself", "okay i'll deal with it tomorrow"];

grow({ NEED_LINES, EMOTION_LINES, DAY_THOUGHTS, ACT_LINES, TIME_LINES, SCROLL_LINES, SELF_LINES }, MORE);
grow({ DAY_THOUGHTS, ACT_LINES }, MORE2);
export const RANDOM_LINES = RAND;
export const MEET_LINES = MEET;

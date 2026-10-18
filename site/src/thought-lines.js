// Lines for the thought bubble that are grounded in the sim (read-only): what he feels (emotion), what he lacks (his
// lowest need) and what he means to do next (the next act in his plan or chain). thoughts.js picks and joins them.
export const NEED_LINES = {
  hunger: ["my stomach is making plans without me.", "i should really eat something.", "running on tea and nothing else."],
  energy: ["so tired. eyes barely open.", "everything is heavy right now.", "i need to lie down soon."],
  fun: ["i need something fun, anything.", "all work and no play, naman.", "bored. wake me when it gets interesting."],
  social: ["it's quiet. wonder who's around.", "i should call someone.", "too long without talking to anyone."],
  focus: ["can't hold a thought for long.", "my head is all over the place.", "need a clear head first."],
  hygiene: ["i could use a wash.", "feeling a bit grimy, honestly.", "a hot shower would fix a lot."],
  bladder: ["ok, i really need the loo.", "can't put this off any longer."],
};
// the act that answers the need, said as the plan
export const NEED_FIX = { hunger: 'eat', energy: 'sleep', fun: 'tv', social: 'phone_call', hygiene: 'shower', bladder: 'loo' };

export const EMOTION_LINES = {
  calm: ["nothing to prove right now.", "quiet in here. good."], content: ["a good day so far.", "this is enough."],
  joyful: ["today feels light.", "i could stay in this mood."], delighted: ["oh, that was nice.", "didn't see that coming. in a good way."],
  curious: ["huh, what if i tried it differently?", "now that's interesting."], absorbed: ["don't break the flow.", "lost track of time again."],
  bored: ["nothing is happening.", "i keep checking the time."], restless: ["can't sit still.", "i keep getting up and sitting down."],
  anxious: ["too many things in my head.", "what if it all falls apart?"], uneasy: ["something feels off.", "can't tell what, but something does."],
  frustrated: ["why won't this just work?", "ok. breathe. try again."], sad: ["a low one. it'll pass.", "just let it be heavy for a while."],
  lonely: ["wish someone would drop by.", "the room is big when it's quiet."], proud: ["ok, that came out well.", "i made that. not bad."],
  relieved: ["phew. that's done.", "finally, that's off my mind."], drowsy: ["eyes getting heavy.", "just five more minutes."],
  dazed: ["running on fumes.", "everything is a bit far away."], nostalgia: ["this reminds me of an older room.", "funny what a song brings back."],
  awe: ["wow. just look at that.", "stopped in my tracks."], aesthetic_appreciation: ["the colours in this are so good.", "beautiful, quietly."],
  amusement: ["trying not to laugh at myself.", "that was a bit funny."], triumph: ["yes. i did the thing.", "that's one for the wall."],
  given_up: ["done for now. it's fine.", "tomorrow, maybe."], embarrassed: ["pretend you didn't see that.", "ok, nobody saw that."],
};

// "then ..." for the act he is about to do
export const NEXT_LINES = {
  tea: "then a hot cup of tea.", eat: "then something to eat.", cook: "then i'll cook something.", fridge: "then a look in the fridge.",
  sleep: "then bed.", nap_bench: "then a nap on the bench.", shower: "then a shower.", night_shower: "then a shower.", brush: "then brush my teeth.", wash: "then wash up.",
  loo: "then the loo.", work: "then back to the desk.", work_through: "then back to the desk.", keys: "then some keys.", guitar: "then the guitar.",
  records: "then a record.", tv: "then some tv.", read: "then a few pages.", window: "then the window for a bit.", snake: "then say hi to the snake.",
  water_plant: "then water the plant.", art_sketch: "then a sketch.", art_refine: "then back to the painting.", art_render: "then render it.", art_review: "then a hard look at it.",
  phone_call: "then call someone.", write_letter: "then write a letter.", gallery_view: "then look at some art.", dress: "then get dressed.", roam: "then wander a bit.", pace: "then pace it out.",
};

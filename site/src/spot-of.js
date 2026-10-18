// The sim's act names -> the room's spot names (shared by his chooser in main.js and hers in companion.js).
// Every act he can live has a spot; build / gather need the sim's open-world grid (not in this room) and stay off-screen.
export const SPOT_OF = { nap_bench: 'nap', gallery_view: 'bench', night_shower: 'shower', work_through: 'work', night_work: 'work', phone_call: 'phone', answer_phone: 'answer', write_letter: 'write',
  art_sketch: 'easel', art_refine: 'easel', art_render: 'easel', art_review: 'easel', water_plant: 'plant', greet_visitor: 'greet', roam: 'roam', run_indoors: 'roam', pace: 'pace',
  wall_bump: 'stumble', false_start: 'glance', build: 'work', gather: 'records' };
export const MICRO = new Set(['yawn', 'stretch', 'sigh', 'fidget', 'sip', 'glance', 'stumble']);   // done where he stands; a seated him stays put

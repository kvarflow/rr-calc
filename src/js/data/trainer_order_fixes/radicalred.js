/* Route trainers put in the order you meet them, by mode: for each boss fight (its key: name|place|first
 * trainer id), the trainers before it as their keys, in order (trainer_controls.js's getTrainerOrderFixes).
 * From players' "Copy order changes" on the Mastersheet. */
var TRAINER_ORDER_FIXES = {normal: {}, hardcore: {}};

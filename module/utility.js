import { HM3 } from './config.js';

/**
 * Determines whether the Skill Base Formula is valid. We perform that
 * validation here so even a skill not associated with a particular
 * actor can have its formula validated.
 * 
 * A valid SB formula looks like this:
 * 
 *   "@str, @int, @sta, hirin:2, ahnu, 5"
 * 
 * meaning
 *   average STR, INT, and STA
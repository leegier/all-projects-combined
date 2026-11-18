// Dialogue scripts. Chapel/tunnel/clearing lines are adapted from the "Nyghtshade Hollow — Dialogue Sourcebook"
// (current canon: Maddox Callahan Thatcher, inmate 1106553; Harrington Marlowe; the baptismal tunnel; "four hours").
// Node format: { who, text, next, choices:[{text, next, cost, cond, fx}], fx, inner }
// `fx` strings are resolved by Story.runFx(); `cond` strings by Story.cond().

export const VOICE = { Maddox: 92, Harrington: 118, Cutter: 140, Pruitt: 105, Tuck: 98, 'CO Reyes': 100, 'CO Dalton': 96, Inmate: 120, Narrator: 90 };

export const DIALOGUE = {
  // ---------------------------------------------------------------------------------------- Cutter
  cutter: {
    start: 'a',
    nodes: {
      a: { who: 'Cutter', text: 'Thatcher. Sit. You look like a man carrying a question.', next: 'b' },
      b: { who: 'Cutter', text: 'Old man Marlowe\'s name moved on the transfer ledger. Intake keeps the book. Page fourteen.', next: 'c' },
      c: {
        who: 'Cutter', text: 'Somebody upstairs wants him out of the chapel before Sunday count. You want to know who signed it, you go through Records.',
        choices: [
          { text: 'Skip the small talk. How do I get in?', next: 'd1', fx: 'fear+2' },
          { text: 'What does Harrington have to do with you?', next: 'd2' },
        ],
      },
      d2: { who: 'Cutter', text: 'Nothing. That\'s the point. A man like that dies in a bed with rails, and nobody on this block asks why. I\'d like somebody to ask.', next: 'd1' },
      d1: {
        who: 'Cutter', text: 'Records is behind Intake. Pruitt\'s got the desk. Three ways in. Pick one.',
        choices: [
          { text: 'Buy the keycard. (60 DC)', cost: 60, cond: 'canKeycard', next: 'buyKey', fx: 'buy:keycard:60' },
          { text: 'Buy a shim and do it quiet. (25 DC)', cost: 25, cond: 'canShim', next: 'buyShim', fx: 'buy:shim:25' },
          { text: 'I\'ll talk to Pruitt myself.', next: 'e' },
          { text: 'And the kitchen job?', next: 'job' },
        ],
      },
      job: { who: 'Cutter', text: 'Tuck needs a mop in the mess hall. Work detail, eight to ten. Thirty DC, no questions. Take it before the guards assign somebody who talks.', fx: 'jobOffer', next: 'd1' },
      buyKey: { who: 'Cutter', text: 'Scratched but it works. If anybody asks, you found it. Camera in there sweeps — watch the corner.', fx: 'cutterDone', end: true },
      buyShim: { who: 'Cutter', text: 'Slide it in the reader and hold. Pruitt turns his head every few seconds. Be somewhere else when he turns it back.', fx: 'cutterDone', end: true },
      e: { who: 'Cutter', text: 'Forty DC and a bad memory — that\'s his rate. You didn\'t hear it from me.', fx: 'cutterDone', end: true },
    },
  },
  cutterAgain: {
    start: 'a',
    nodes: {
      a: {
        who: 'Cutter', text: 'Back already. What do you need?',
        choices: [
          { text: 'The keycard. (60 DC)', cost: 60, cond: 'canKeycard', next: 'ok', fx: 'buy:keycard:60' },
          { text: 'The shim. (25 DC)', cost: 25, cond: 'canShim', next: 'ok2', fx: 'buy:shim:25' },
          { text: 'Sell him a pack of cigarettes. (+8 DC)', cond: 'hasCigs', next: 'sold', fx: 'sellCig' },
          { text: 'Nothing.', end: true },
        ],
      },
      ok: { who: 'Cutter', text: 'Pleasure.', end: true },
      ok2: { who: 'Cutter', text: 'Hold it steady. Don\'t be the reason I lose a customer.', end: true },
      sold: { who: 'Cutter', text: 'Hard currency. I like that in a man.', end: true },
    },
  },
  // ---------------------------------------------------------------------------------------- Tuck
  tuck: {
    start: 'a',
    nodes: {
      a: { who: 'Tuck', text: 'Tray\'s free. Seconds cost. Don\'t make that face, it\'s eggs.', fx: 'giveTray', end: true },
    },
  },
  tuckNo: { start: 'a', nodes: { a: { who: 'Tuck', text: 'Chow\'s over, Thatcher. Come back at the bell.', end: true } } },
  tuckHave: { start: 'a', nodes: { a: { who: 'Tuck', text: 'You already got one. Eat it before it files an appeal.', end: true } } },
  // ---------------------------------------------------------------------------------------- Pruitt
  pruitt: {
    start: 'a',
    nodes: {
      a: { who: 'CO Pruitt', text: 'Eyes forward, Thatcher. Nobody\'s here to chat.', next: 'b' },
      b: {
        who: 'CO Pruitt', text: 'If you\'re lost, the mess hall is that way. If you\'re not lost, you\'re wasting my morning.',
        choices: [
          { text: 'I hear Records keeps good books.', next: 'c', cond: 'knowsLedger' },
          { text: 'Just passing through.', end: true },
        ],
      },
      c: { who: 'CO Pruitt', text: '...Who\'s been talking to you.', next: 'd' },
      d: {
        who: 'CO Pruitt', text: 'Forty DC gets you three minutes, a bad memory, and a door that isn\'t locked. Anything walks out with you, I never met you.',
        choices: [
          { text: 'Pay Pruitt 40 DC.', cost: 40, cond: 'canBribe', next: 'paid', fx: 'bribe' },
          { text: 'Not today.', end: true },
        ],
      },
      paid: { who: 'CO Pruitt', text: 'Door\'s open. Don\'t touch anything that isn\'t yours.', end: true },
    },
  },
  pruittDone: { start: 'a', nodes: { a: { who: 'CO Pruitt', text: 'Clock\'s running, Thatcher. Not my clock. Yours.', end: true } } },
  // ---------------------------------------------------------------------------------------- Harrington (canon 3A/3B adapted)
  harrington: {
    start: 'a',
    nodes: {
      a: { who: 'Harrington', text: 'You\'re early. Or I\'m late. At my age it\'s hard to tell which is the vice.', next: 'b' },
      b: {
        who: 'Harrington', text: 'Cutter says you went looking for paper.',
        choices: [
          { text: 'Page fourteen. They\'re moving you.', next: 'c', cond: 'hasLedger', fx: 'giveLedger' },
          { text: 'Maybe. What do you want, old man?', next: 'c2' },
        ],
      },
      c2: { who: 'Harrington', text: 'The truth is a thing I collect. Show me the page and I\'ll show you something better.', cond: 'hasLedger', next: 'b' },
      c: { who: 'Harrington', text: 'Mercy Ridge. A bed with rails by the weekend. Well. They\'ve been very patient with me.', next: 'd' },
      d: { who: 'Harrington', text: 'Forty years I\'ve counted steps in here, Maddox. Not one of them was mine. Come. Put your back into the baptismal.', fx: 'harringtonLeadsFont', end: true },
    },
  },
  harringtonWait: { start: 'a', nodes: { a: { who: 'Harrington', text: 'The font, son. Hands under the rim. Slow — stone remembers being hurried.', end: true } } },
  harringtonIdle: { start: 'a', nodes: { a: { who: 'Harrington', text: 'Bring me the page, and sit a while after. The pews are the last honest furniture in this place.', end: true } } },
  // Tunnel rules (canon 3B)
  tunnelRules: {
    start: 'a',
    nodes: {
      a: { who: 'Harrington', text: 'Then we plan it the same way you plan a yard. Boundaries. No crowds. No lights. No open street.', next: 'b' },
      b: { who: 'Maddox', text: 'I am not exactly built for blending.', next: 'c' },
      c: { who: 'Harrington', text: 'Then you do not test it.', next: 'd' },
      d: { who: 'Maddox', text: 'So I act like I belong.', next: 'e' },
      e: { who: 'Harrington', text: 'Exactly. Nothing fast. Nothing hungry.', next: 'f' },
      f: { who: 'Maddox', text: 'Four hours of pretending I am not a ghost.', next: 'g' },
      g: { who: 'Harrington', text: 'Four hours of remembering you are not one.', fx: 'tunnelRulesDone', end: true },
    },
  },
  // Clearing (canon 3A, abridged)
  clearing: {
    start: 'a',
    nodes: {
      a: { who: 'Harrington', text: 'Past the tree line there is a clearing. Old oak, four feet through. A crate. A blanket, a couple of books, a little food. I used to carry it easy. Not now.', next: 'b' },
      b: { who: 'Maddox', text: 'Four hours. Not five minutes. What do you even do with that?', next: 'c' },
      c: { who: 'Harrington', text: 'Sit. Listen. Read. Feel grass through your socks. Hear a car go by where no one is counting you.', next: 'd' },
      d: { who: 'Maddox', text: 'That is a dangerous amount of freedom.', next: 'e' },
      e: { who: 'Harrington', text: 'Because five minutes feels like mercy. Four hours feels like your life is yours again.', next: 'f' },
      f: { who: 'Harrington', text: 'You keep your word. You come back. Every time.', next: 'g' },
      g: { who: 'Maddox', text: 'I will.', next: 'h' },
      h: { who: 'Harrington', text: 'Heaven is loud. Out there, it is just quiet enough to hear yourself again.', fx: 'endDemo', end: true },
    },
  },
  // ---------------------------------------------------------------------------------------- Flavour
  inmate1: { start: 'a', nodes: { a: { who: 'Inmate', text: 'Keep it moving, big man. Count\'s bad enough without you standing in my light.', end: true } } },
  inmate2: { start: 'a', nodes: { a: { who: 'Inmate', text: 'Heard Cutter\'s moving paper on the old man. Don\'t look at me. I didn\'t say it.', end: true } } },
  inmate3: { start: 'a', nodes: { a: { who: 'Inmate', text: 'Eggs again. Some day I\'m going to find the chicken and apologize.', end: true } } },
  inmate4: { start: 'a', nodes: { a: { who: 'Inmate', text: 'I pray here at one. Not for me. Mostly for the roof.', end: true } } },
  reyesLine: { start: 'a', nodes: { a: { who: 'CO Reyes', text: 'Move along, Thatcher. Count\'s a paperwork problem, not a social one.', end: true } } },
  daltonLine: { start: 'a', nodes: { a: { who: 'CO Dalton', text: 'Walk. Don\'t run. Running makes me curious.', end: true } } },
};

export const BARKS = {
  wake: ['Same ceiling. Same crack in it. Four thousand and some mornings.', 'Nine years. They count us twice a day like we might have gone somewhere.'],
  countStart: 'Count! On your feet. Face the bars.',
  countTap: 'One-one-zero-six-five-five-three. Thatcher.',
  countOk: 'Good. Doors in five. Don\'t make me regret it.',
  countFail: 'Not at the bars, Thatcher. Write-up. Count\'s not optional.',
};

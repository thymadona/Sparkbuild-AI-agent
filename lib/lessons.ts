import type { TaskCheck } from './task-checks'

// 'homework' tasks are done at home, after class. Like core tasks they hold back
// build mode, so the AI cannot do the assignment for the student.
export type LessonTaskType = 'core' | 'choice' | 'bonus' | 'homework'

export const CURRENT_LESSON_VERSION = 2

export interface LessonTask {
  id: string
  type: LessonTaskType
  chip: string
  success: string
  prompt: string
  commentAnchor: string
  // When present, the student cannot mark the task done until the file shows
  // the change. Tasks without checks stay self-reported.
  checks?: TaskCheck[]
}

export interface Lesson {
  id: number
  title: string
  description: string
  templateFile: string
  // One short line telling the student what this week's homework is about.
  homeworkBrief?: string
  tasks: LessonTask[]
}

export const LESSONS: Lesson[] = [
  {
    id: 1,
    title: 'Week #1 — Profile Pop',
    homeworkBrief: 'Add one new thing to your page.',
    description: 'Create a colorful profile card that makes your personality impossible to miss.',
    templateFile: 'personal-page.html',
    tasks: [
      {
        id: 'identity',
        type: 'core',
        chip: 'Write your intro',
        success: 'Your card has your name on it.',
        prompt: 'Help me replace the name and short intro in my profile card with words that sound like me.',
        commentAnchor: 'TASK: identity',
        checks: [
          { kind: 'textChanged', selector: 'h1', from: 'Hey, I’m Your Name.', label: 'The title has your name', hint: 'Change "Your Name" in the big title.' },
          { kind: 'textChanged', selector: '.lead', from: 'I’m a curious creator who loves turning big ideas into small, colorful experiments.', label: 'You wrote your own intro', hint: 'Rewrite the line under your name.' },
        ],
      },
      {
        id: 'interests',
        type: 'core',
        chip: 'Pick your interests',
        success: 'Your chips show things you like.',
        prompt: 'Show me how to replace or add one interest chip in my profile card.',
        commentAnchor: 'TASK: interests',
        checks: [
          { kind: 'textChanged', selector: '.chips', from: '🎮 games🎵 music🌱 nature', label: 'Your chips are things you like', hint: 'Change one chip to something you like.' },
        ],
      },
      {
        id: 'palette',
        type: 'core',
        chip: 'Choose your colors',
        success: 'You picked your own colors.',
        prompt: 'Help me choose three colors and update the CSS variables for my profile card.',
        commentAnchor: 'TASK: palette',
        checks: [
          { kind: 'sourceOmits', snippet: '--pink: #ff6b9d', label: 'You picked your own pink', hint: 'Change --pink at the top to your color.' },
          { kind: 'sourceOmits', snippet: '--purple: #7655e8', label: 'You picked your own purple', hint: 'Change --purple at the top to your color.' },
          { kind: 'sourceOmits', snippet: '--yellow: #ffd86b', label: 'You picked your own yellow', hint: 'Change --yellow at the top to your color.' },
        ],
      },
      {
        id: 'spotlight',
        type: 'choice',
        chip: 'Make it yours',
        success: 'Your card shares something about you.',
        prompt: 'Help me turn the spotlight card into something personal, like a hobby, dream, or fun fact.',
        commentAnchor: 'TASK: spotlight',
        checks: [
          { kind: 'textChanged', selector: '.spotlight p', from: 'Right now, I’m learning to make cool things with code. Next I want to build something that helps people smile.', label: 'The green card is about you', hint: 'Write about you in the green card.' },
        ],
      },
      {
        id: 'mood',
        type: 'bonus',
        chip: 'Bonus: add a mood switch',
        success: 'Your button shows your own messages.',
        prompt: 'Help me add a small button that changes the mood message on my profile.',
        commentAnchor: 'BONUS: mood switch',
        checks: [
          { kind: 'sourceOmits', snippet: 'Tiny steps still count.', label: 'The mood messages are yours', hint: 'Change the first message in the moods list.' },
        ],
      },
      {
        id: 'hw-chip',
        type: 'homework',
        chip: 'Homework: add a chip',
        success: 'Your page has four chips.',
        prompt: 'I want to add one more interest chip to my profile card at home.',
        commentAnchor: 'TASK: interests',
        checks: [
          { kind: 'sourceMatches', pattern: 'class="chip"', min: 4, example: '<span class="chip">📚 books</span>', label: 'There are four chips', hint: 'Add one more chip like the others.' },
        ],
      },
      {
        id: 'hw-avatar',
        type: 'homework',
        chip: 'Homework: new avatar',
        success: 'Your avatar shows your own emoji.',
        prompt: 'I want to change the emoji in my avatar circle.',
        commentAnchor: 'TASK: identity',
        checks: [
          { kind: 'textChanged', selector: '.avatar', from: '😎✦', label: 'The avatar is yours', hint: 'Change the emoji in the avatar.' },
        ],
      },
      {
        id: 'hw-image',
        type: 'homework',
        chip: 'Homework: add a picture',
        success: 'Your page shows a picture.',
        prompt: 'I want to add a real picture to my page with an img tag.',
        commentAnchor: 'TASK: spotlight',
        checks: [
          { kind: 'sourceMatches', pattern: '<img', min: 1, example: '<img src="https://picsum.photos/200" alt="a photo I like" />', label: 'There is a picture', hint: 'Add an img tag with a picture link.' },
        ],
      },
    ],
  },
  {
    id: 2,
    title: 'Week #2 — Vibe Mixer',
    homeworkBrief: 'Add a fourth mood to your mixer.',
    description: 'Build a playful mood picker with buttons that instantly change the page.',
    templateFile: 'interactive-page.html',
    tasks: [
      {
        id: 'studio-name',
        type: 'core',
        chip: 'Name your studio',
        success: 'Your mixer has your own name.',
        prompt: 'Help me rename the Vibe Mixer and write a welcome line that fits my idea.',
        commentAnchor: 'TASK: studio name',
        checks: [
          { kind: 'textChanged', selector: 'h1', from: 'Welcome to the Vibe Mixer.', label: 'Your mixer has your name', hint: 'Change "Vibe Mixer" in the big title.' },
          { kind: 'textChanged', selector: '.intro', from: 'Pick an energy, get a tiny pep talk, and make this page match your own world.', label: 'You wrote your own intro', hint: 'Rewrite the line under the title.' },
        ],
      },
      {
        id: 'vibes',
        type: 'core',
        chip: 'Create your vibe buttons',
        success: 'You picked three moods of your own.',
        prompt: 'Show me how to change the labels and emojis on the vibe buttons.',
        commentAnchor: 'TASK: vibe buttons',
        checks: [
          { kind: 'textChanged', selector: '.vibes', from: '⚡Full of spark🎯Ready to focus🌈Keeping it chill', label: 'Your buttons show your moods', hint: 'Change the three button labels to your moods.' },
        ],
      },
      {
        id: 'responses',
        type: 'core',
        chip: 'Write the responses',
        success: 'Each button shows your own message.',
        prompt: 'Help me edit the JavaScript responses so each vibe has a fun message.',
        commentAnchor: 'TASK: vibe responses',
        checks: [
          { kind: 'sourceOmits', snippet: '⚡ Big energy! Pick one tiny idea and turn it into something real.', label: 'Message 1 is yours', hint: 'Change the first message in the list.' },
          { kind: 'sourceOmits', snippet: '🎯 Focus mode on. Make one change, test it, then celebrate it.', label: 'Message 2 is yours', hint: 'Change the second message in the list.' },
          { kind: 'sourceOmits', snippet: '🌈 Chill is powerful. Explore, play, and see what happens.', label: 'Message 3 is yours', hint: 'Change the third message in the list.' },
        ],
      },
      {
        id: 'theme',
        type: 'choice',
        chip: 'Make it yours',
        success: 'You picked a theme for your page.',
        prompt: 'Help me personalize this page with a theme such as space, sport, music, or nature.',
        commentAnchor: 'TASK: theme choice',
        checks: [
          { kind: 'textChanged', selector: '.theme p', from: 'Turn this into a space station, music booth, sports zone, or whatever feels most you.', label: 'Your card names your theme', hint: 'Say which theme you picked on the pink card.' },
          { kind: 'sourceOmits', snippet: '--sky: #63d6ff', label: 'The colors fit your theme', hint: 'Change --sky at the top to your color.' },
        ],
      },
      {
        id: 'surprise',
        type: 'bonus',
        chip: 'Bonus: surprise mode',
        success: 'Your surprise button has your words.',
        prompt: 'Help me add a Surprise me button that randomly chooses one of the vibes.',
        commentAnchor: 'BONUS: surprise mode',
        checks: [
          { kind: 'textChanged', selector: 'button.surprise', from: 'Surprise me ✦', label: 'The surprise button is yours', hint: 'Change the words on the surprise button.' },
        ],
      },
      {
        id: 'hw-fourth-vibe',
        type: 'homework',
        chip: 'Homework: fourth button',
        success: 'Your mixer has four buttons.',
        prompt: 'I want to add a fourth vibe button with its own message.',
        commentAnchor: 'TASK: vibe buttons',
        checks: [
          { kind: 'sourceMatches', pattern: 'class="vibe"', min: 4, example: '<button class="vibe" onclick="showVibe(\'brave\')"><span>🦁</span>Feeling brave</button>', label: 'There are four buttons', hint: 'Copy a button and change its words.' },
          { kind: 'sourceMatches', pattern: "showVibe\\('", min: 4, example: 'onclick="showVibe(\'brave\')"', label: 'The new button works', hint: 'Give the new button its own name.' },
        ],
      },
      {
        id: 'hw-waiting-words',
        type: 'homework',
        chip: 'Homework: waiting words',
        success: 'Your result box has your words.',
        prompt: 'I want to change the text that shows before anyone clicks a vibe.',
        commentAnchor: 'TASK: vibe responses',
        checks: [
          { kind: 'textChanged', selector: '#result', from: 'Your next vibe will appear here.', label: 'The result box is yours', hint: 'Change the words in the result box.' },
        ],
      },
    ],
  },
  {
    id: 3,
    title: 'Week #3 — Streak Spark',
    homeworkBrief: 'Make your tracker count down too.',
    description: 'Track a goal, build a streak, and celebrate progress with JavaScript.',
    templateFile: 'score-page.html',
    tasks: [
      {
        id: 'goal',
        type: 'core',
        chip: 'Choose a goal',
        success: 'Your tracker shows your own goal.',
        prompt: 'Help me rename this streak tracker for a goal I care about, like reading, drawing, or practice.',
        commentAnchor: 'TASK: goal name',
        checks: [
          {
            kind: 'textChanged',
            selector: 'h1',
            from: 'My reading streak.',
            label: 'The title names your goal',
            hint: 'Change the big title to your goal.',
          },
          {
            kind: 'textChanged',
            selector: '.subtitle',
            from: 'One little action can turn into a habit. What will you track today?',
            label: 'You wrote your own intro',
            hint: 'Rewrite the line under the title.',
          },
        ],
      },
      {
        id: 'counter',
        type: 'core',
        chip: 'Name your buttons',
        success: 'Your two buttons fit your goal.',
        prompt: 'Show me how to change the button labels for my own goal tracker.',
        commentAnchor: 'TASK: counter labels',
        checks: [
          {
            kind: 'textChanged',
            selector: 'button.primary',
            from: 'I did it! +1',
            label: 'The +1 button is yours',
            hint: 'Change the words on the orange button.',
          },
          {
            kind: 'textChanged',
            selector: '.score-card button:not(.primary)',
            from: 'Reset',
            label: 'The reset button is yours',
            hint: 'Change "Reset" to your own words.',
          },
        ],
      },
      {
        id: 'milestones',
        type: 'core',
        chip: 'Write your cheers',
        success: 'Your app cheers you on three times.',
        prompt: 'Help me write encouraging milestone messages for my goal tracker.',
        commentAnchor: 'TASK: milestones',
        checks: [
          {
            kind: 'sourceOmits',
            snippet: 'First step complete — you started!',
            label: 'Cheer 1 is yours',
            hint: 'Change the first cheer in the list.',
          },
          {
            kind: 'sourceOmits',
            snippet: 'Three in a row! Your streak has a spark.',
            label: 'Cheer 2 is yours',
            hint: 'Change the second cheer in the list.',
          },
          {
            kind: 'sourceOmits',
            snippet: 'Five wins! You are building momentum.',
            label: 'Cheer 3 is yours',
            hint: 'Change the third cheer in the list.',
          },
        ],
      },
      {
        id: 'reward',
        type: 'choice',
        chip: 'Make it yours',
        success: 'You picked a reward to keep going.',
        prompt: 'Help me customize the reward card with something that motivates me.',
        commentAnchor: 'TASK: reward choice',
        checks: [
          {
            kind: 'textChanged',
            selector: '.reward',
            from: 'My reward at 7 days: a cosy movie night 🍿',
            label: 'The reward card is yours',
            hint: 'Change the green card to your reward.',
          },
        ],
      },
      {
        id: 'custom-milestone',
        type: 'bonus',
        chip: 'Bonus: one more cheer',
        success: 'You added one more cheer.',
        prompt: 'Help me add a new JavaScript milestone at a number I choose.',
        commentAnchor: 'BONUS: custom milestone',
        checks: [
          {
            kind: 'sourceMatches',
            pattern: "\\d+\\s*:\\s*['\"`]",
            min: 4,
            example: "7: 'One week!',",
            label: 'There are four cheers now',
            hint: "Add one more line, like 7: 'One week!'",
          },
        ],
      },
      {
        id: 'hw-sixth-dot',
        type: 'homework',
        chip: 'Homework: sixth dot',
        success: 'Your streak map has six dots.',
        prompt: 'I want to add a sixth dot to my streak map and make it light up.',
        commentAnchor: 'TASK: reward choice',
        checks: [
          { kind: 'sourceMatches', pattern: 'class="dot"', min: 6, example: '<span class="dot"></span>', label: 'There are six dots', hint: 'Add one more dot span.' },
          { kind: 'sourceOmits', snippet: 'Math.min(score, 5)', label: 'Six dots can light up', hint: 'Change the 5 in Math.min to 6.' },
        ],
      },
      {
        id: 'hw-take-away',
        type: 'homework',
        chip: 'Homework: take one away',
        success: 'Your app can go down too.',
        prompt: 'I want a button that takes one away from my streak when I make a mistake.',
        commentAnchor: 'TASK: counter labels',
        checks: [
          { kind: 'sourceMatches', pattern: 'score\\s*-=', min: 1, example: 'function removeScore() { score -= 1; render() }', label: 'Your code takes one away', hint: 'Write score -= 1 in a new function.' },
          { kind: 'sourceMatches', pattern: '<button', min: 3, example: '<button onclick="removeScore()">Oops, minus one</button>', label: 'There is a third button', hint: 'Add a button that calls your function.' },
        ],
      },
    ],
  },
  {
    id: 4,
    title: 'Week #4 — Reflex Rush',
    homeworkBrief: 'Make your game flash and show more.',
    description: 'Turn your code into an arcade-style reaction game with a timer and score.',
    templateFile: 'hard-game.html',
    tasks: [
      {
        id: 'game-name',
        type: 'core',
        chip: 'Name your game',
        success: 'Your game has a name and rules.',
        prompt: 'Help me rename my reaction game and write short instructions for players.',
        commentAnchor: 'TASK: game name',
        checks: [
          { kind: 'textChanged', selector: 'h1', from: 'Reflex Rush', label: 'Your game has your title', hint: 'Change "Reflex Rush" to your game name.' },
          { kind: 'textChanged', selector: '.instructions', from: 'Tap the glowing target as many times as you can before the timer reaches zero.', label: 'You wrote how to play', hint: 'Rewrite the line about how to play.' },
        ],
      },
      {
        id: 'rules',
        type: 'core',
        chip: 'Set the rules',
        success: 'You picked the timer and the speed.',
        prompt: 'Show me how to change the game duration and target speed in the settings.',
        commentAnchor: 'TASK: game settings',
        checks: [
          { kind: 'sourceOmits', snippet: 'const gameDuration = 10', label: 'You picked the timer', hint: 'Change gameDuration from 10 to your number.' },
          { kind: 'sourceOmits', snippet: 'const moveDelay = 700', label: 'You picked the speed', hint: 'Change moveDelay from 700. Smaller is faster.' },
        ],
      },
      {
        id: 'score-messages',
        type: 'core',
        chip: 'Add score messages',
        success: 'Players see your cheers as they score.',
        prompt: 'Help me write three energetic score messages for my game.',
        commentAnchor: 'TASK: score messages',
        checks: [
          { kind: 'sourceOmits', snippet: '🌟 Reflex legend!', label: 'The top cheer is yours', hint: 'Change the message for 10 points.' },
          { kind: 'sourceOmits', snippet: '⚡ You are on fire!', label: 'The middle cheer is yours', hint: 'Change the message for 5 points.' },
          { kind: 'sourceOmits', snippet: 'Nice hit — keep going!', label: 'The first cheer is yours', hint: 'Change the message for the first hit.' },
        ],
      },
      {
        id: 'arena',
        type: 'choice',
        chip: 'Make it yours',
        success: 'Your arena looks like your theme.',
        prompt: 'Help me style the game arena around a theme I like, such as neon, jungle, or space.',
        commentAnchor: 'TASK: arena theme',
        checks: [
          { kind: 'sourceOmits', snippet: 'linear-gradient(130deg, #2b2462, #161b3e)', label: 'The arena has your colors', hint: 'Change the background of #game-area to your colors.' },
        ],
      },
      {
        id: 'hard-mode',
        type: 'bonus',
        chip: 'Bonus: hard mode',
        success: 'The target shrinks as you score.',
        prompt: 'Help me turn on and customize hard mode so the game gets tougher.',
        commentAnchor: 'BONUS: hard mode',
        checks: [
          { kind: 'sourceMatches', pattern: 'target\\.style\\.width', example: "target.style.width = '40px'", label: 'The target changes size', hint: 'In hitTarget, set target.style.width smaller.' },
        ],
      },
      {
        id: 'hw-target-color',
        type: 'homework',
        chip: 'Homework: flashing target',
        success: 'Your target changes color on hits.',
        prompt: 'I want the target to change color every time I hit it.',
        commentAnchor: 'TASK: score messages',
        checks: [
          { kind: 'sourceMatches', pattern: 'target\\.style\\.background', min: 1, example: "target.style.background = 'gold'", label: 'The target changes color', hint: 'Set the target background inside hitTarget.' },
        ],
      },
      {
        id: 'hw-third-stat',
        type: 'homework',
        chip: 'Homework: third stat',
        success: 'Your scoreboard shows three numbers.',
        prompt: 'I want to add a third box to my scoreboard.',
        commentAnchor: 'TASK: game name',
        checks: [
          { kind: 'sourceMatches', pattern: 'class="stat"', min: 3, example: '<div class="stat"><b id="best">0</b><span>best</span></div>', label: 'There are three stat boxes', hint: 'Copy a stat box and rename it.' },
        ],
      },
    ],
  },
  {
    id: 5,
    title: 'Week #5 — Inspiration Lab',
    homeworkBrief: 'Add a third card that loads something.',
    description: 'Use live APIs to bring jokes, quotes, and fresh ideas into your own app.',
    templateFile: 'ai-page.html',
    tasks: [
      {
        id: 'lab-name',
        type: 'core',
        chip: 'Name your lab',
        success: 'Your lab has your own name.',
        prompt: 'Help me rename this Inspiration Lab and write a clear one-sentence description.',
        commentAnchor: 'TASK: lab name',
        checks: [
          { kind: 'textChanged', selector: 'h1', from: 'The Inspiration Lab.', label: 'Your lab has your name', hint: 'Change "The Inspiration Lab" to your name.' },
          { kind: 'textChanged', selector: '.intro', from: 'Press a button, ask the internet for a surprise, then turn this lab into your own pocket of ideas.', label: 'You wrote your own line', hint: 'Rewrite the line under the title.' },
        ],
      },
      {
        id: 'joke-result',
        type: 'core',
        chip: 'Style live results',
        success: 'Your first card has your own words.',
        prompt: 'Help me customize the result text and loading message for the first API card.',
        commentAnchor: 'TASK: joke result',
        checks: [
          { kind: 'textChanged', selector: '#joke-result', from: 'A joke will land here.', label: 'The waiting words are yours', hint: 'Change "A joke will land here."' },
          { kind: 'sourceOmits', snippet: 'Mixing up something fresh…', label: 'The loading words are yours', hint: 'Change the loading text in setLoading.' },
        ],
      },
      {
        id: 'quote-result',
        type: 'core',
        chip: 'Fix the second card',
        success: 'Your second card has your own words.',
        prompt: 'Show me how to edit the second API card title, description, and placeholder.',
        commentAnchor: 'TASK: quote result',
        checks: [
          { kind: 'textChanged', selector: '.lab article:nth-child(2) h2', from: 'Quote cloud', label: 'The second card has your title', hint: 'Change "Quote cloud" to your own title.' },
          { kind: 'textChanged', selector: '#quote-result', from: 'A quote will float in here.', label: 'The waiting words are yours', hint: 'Change "A quote will float in here."' },
        ],
      },
      {
        id: 'collection',
        type: 'choice',
        chip: 'Make it yours',
        success: 'You said what you collect.',
        prompt: 'Help me give this lab a personal theme, such as comedy, motivation, or creativity.',
        commentAnchor: 'TASK: collection choice',
        checks: [
          { kind: 'textChanged', selector: '.notes article:first-child p', from: 'I’m collecting funny, brave, creative, and unexpected ideas.', label: 'Your card says what you collect', hint: 'Change the purple card to your idea.' },
        ],
      },
      {
        id: 'loading',
        type: 'bonus',
        chip: 'Bonus: better loading',
        success: 'The button talks while it waits.',
        prompt: 'Help me improve the loading state so a visitor knows the app is working.',
        commentAnchor: 'BONUS: loading state',
        checks: [
          { kind: 'sourceOmits', snippet: "'Finding one…'", label: 'The button words are yours', hint: 'Change "Finding one…" in fetchJoke.' },
        ],
      },
      {
        id: 'hw-third-card',
        type: 'homework',
        chip: 'Homework: third card',
        success: 'Your lab has three live cards.',
        prompt: 'I want to add a third card that loads something new from the internet.',
        commentAnchor: 'TASK: quote result',
        checks: [
          { kind: 'sourceMatches', pattern: 'class="experiment"', min: 3, example: '<article class="experiment">my third card</article>', label: 'There are three cards', hint: 'Copy a card and change its title.' },
          { kind: 'sourceMatches', pattern: 'fetch\\(', min: 3, example: "const response = await fetch('https://api.example.com/thing')", label: 'The third card loads data', hint: 'Write one more fetch for the new card.' },
        ],
      },
      {
        id: 'hw-two-lines',
        type: 'homework',
        chip: 'Homework: two lines',
        success: 'Your joke shows on two lines.',
        prompt: 'I want the joke setup and punchline on two separate lines.',
        commentAnchor: 'TASK: joke result',
        checks: [
          { kind: 'sourceMatches', pattern: 'innerHTML', min: 1, example: "box.innerHTML = joke.setup + '<br>' + joke.punchline", label: 'The joke uses two lines', hint: 'Use innerHTML with a br tag between them.' },
        ],
      },
    ],
  },
  {
    id: 6,
    title: 'Week #6 — Bright Idea',
    homeworkBrief: 'Save the ideas your app gives you.',
    description: 'Pitch and prototype a small app that solves a real problem for someone.',
    templateFile: 'my-project.html',
    tasks: [
      {
        id: 'project-name',
        type: 'core',
        chip: 'Name your idea',
        success: 'Your project has your own name.',
        prompt: 'Help me name my project and write a one-sentence promise for what it helps people do.',
        commentAnchor: 'TASK: project name',
        checks: [
          { kind: 'textChanged', selector: 'h1', from: 'Kindness Queue', label: 'Your project has your name', hint: 'Change "Kindness Queue" to your name.' },
          { kind: 'textChanged', selector: '.promise', from: 'A tiny tool that helps busy students remember one kind thing they can do for someone today.', label: 'You wrote your one line', hint: 'Rewrite the line under the title.' },
        ],
      },
      {
        id: 'problem',
        type: 'core',
        chip: 'Say the problem',
        success: 'You said who needs help and why.',
        prompt: 'Help me write a short, specific problem statement for my project.',
        commentAnchor: 'TASK: problem statement',
        checks: [
          { kind: 'textChanged', selector: '.problem p', from: 'Sometimes people want to help, but they cannot think of an idea in the moment. Small kindnesses get forgotten when life gets busy.', label: 'The problem is in your words', hint: 'Rewrite the yellow card in your words.' },
          { kind: 'textChanged', selector: '.who', from: 'For: busy students', label: 'You said who it helps', hint: 'Change "For: busy students" to your people.' },
        ],
      },
      {
        id: 'prototype',
        type: 'core',
        chip: 'Build the first feature',
        success: 'Your button does something useful.',
        prompt: 'Help me replace the demo interaction with a simple first feature for my idea.',
        commentAnchor: 'TASK: first feature',
        checks: [
          { kind: 'textChanged', selector: '.prototype p', from: 'Tap the button to get a tiny act of kindness. Replace this demo with the first useful action for your own app.', label: 'You wrote your first feature', hint: 'Rewrite the blue panel to your feature.' },
          { kind: 'sourceOmits', snippet: 'Send someone a message that makes them smile.', label: 'The button does your thing', hint: 'Change the first idea in the ideas list.' },
        ],
      },
      {
        id: 'pitch',
        type: 'choice',
        chip: 'Make it yours',
        success: 'Your pitch makes people want to try.',
        prompt: 'Help me make the pitch card sound exciting and clear for people who might use my app.',
        commentAnchor: 'TASK: pitch choice',
        checks: [
          { kind: 'textChanged', selector: '.map article:nth-child(2) p', from: 'Kindness Queue gives you one doable idea in seconds. No perfect plan needed—just one bright next move.', label: 'The pitch is yours', hint: 'Rewrite the "Why try it?" card.' },
        ],
      },
      {
        id: 'next-step',
        type: 'bonus',
        chip: 'Bonus: next version',
        success: 'You named your next feature.',
        prompt: 'Help me add one realistic next feature I would build with another week.',
        commentAnchor: 'BONUS: next version',
        checks: [
          { kind: 'textChanged', selector: '.finish article:first-child p', from: 'I would let people save their favorite ideas and make their own kindness list.', label: 'You named your next step', hint: 'Change the pink card to your next feature.' },
        ],
      },
      {
        id: 'hw-save-list',
        type: 'homework',
        chip: 'Homework: save a list',
        success: 'Your app keeps a list.',
        prompt: 'I want my app to remember the ideas it gives me in a list.',
        commentAnchor: 'TASK: first feature',
        checks: [
          { kind: 'sourceMatches', pattern: '\\.push\\(', min: 1, example: 'saved.push(idea)', label: 'Your code saves to a list', hint: 'Use push to add to an array.' },
        ],
      },
      {
        id: 'hw-second-button',
        type: 'homework',
        chip: 'Homework: second button',
        success: 'Your app has two buttons.',
        prompt: 'I want a second button that shows the list my app saved.',
        commentAnchor: 'TASK: first feature',
        checks: [
          { kind: 'sourceMatches', pattern: '<button', min: 2, example: '<button onclick="showSaved()">See my list</button>', label: 'There are two buttons', hint: 'Add one more button to your page.' },
        ],
      },
    ],
  },
]

function legacyTask(id: string, chip: string, prompt: string, commentAnchor: string): LessonTask {
  return { id, type: 'core', chip, success: 'This part of your original lesson is complete.', prompt, commentAnchor }
}

// Projects created before the studio refresh have HTML with these original anchors.
// Keeping this catalog prevents a resumed legacy project from receiving mismatched guidance.
export const LEGACY_LESSONS: Lesson[] = [
  { id: 1, title: 'Week #1 — My Personal Page', description: 'Build your own personal webpage with a heading, styles, and a button.', templateFile: 'personal-page.html', tasks: [
    legacyTask('TASK 1', 'Task 1 — Add your name', 'I need to put my name in the <h1> tag and the <title> tag. How do I do that?', 'CHANGE THIS: Your name and one sentence about you'),
    legacyTask('TASK 2', 'Task 2 — Change your tags', 'I want to update the interest tags to reflect my own hobbies. How do I add or remove a <span> tag?', 'CHANGE THIS: Add or remove tags that describe you'),
    legacyTask('TASK 3', 'Task 3 — Change the colors', 'I want to change the background and accent colors using the CSS variables at the top. How do I pick a color and update the hex code?', 'COLORS — change these to colors you like'),
    legacyTask('TASK 4', 'Task 4 — Write about yourself', "I need to fill in the 'What I'm into right now' section with something I actually like. Can you help me write a couple of sentences?", 'CHANGE THIS: Write about something you love'),
    legacyTask('TASK 5', 'Task 5 — Add an image (bonus)', 'I want to try the optional image section. How do I uncomment the <img> tag and use a real image URL?', 'THIS PART IS OPTIONAL'),
  ] },
  { id: 2, title: 'Week #2 — Make It React', description: 'Add buttons and JavaScript so your page responds when someone clicks.', templateFile: 'interactive-page.html', tasks: [
    legacyTask('TASK 1', 'Task 1 — Update your intro', 'I need to change the h1 and intro paragraph to say my name and describe what my page does. How do I edit text inside HTML tags?', 'CHANGE THIS: Your name and a short intro'),
    legacyTask('TASK 2', 'Task 2 — Change the secret message', 'I want to change what appears inside the secret-box div when the button is clicked. How do I edit the text inside a div?', 'CHANGE THIS: The button label and secret message'),
    legacyTask('TASK 3', 'Task 3 — Add a mood option', "I want to add a fourth mood button called 'focused' with its own response message. How do I add a new button and add a new line to the responses object?", 'CHANGE THIS: Your mood options and responses'),
    legacyTask('TASK 4', 'Task 4 — Change the mood responses', 'I want to rewrite the text responses for each mood so they sound like me. Where do I find the response text and how do I change it?', 'CHANGE THIS: The mood responses'),
    legacyTask('TASK 5', 'Task 5 — Change the accent color', 'I want to change the green accent color to something that fits my style. How do I find a hex code and update the CSS variable?', 'COLORS — change these to colors you like'),
  ] },
  { id: 3, title: 'Week #3 — Keep Score', description: 'Use a variable to track a number that changes. Build something with a score, count, or progress.', templateFile: 'score-page.html', tasks: [
    legacyTask('TASK 1', 'Task 1 — Name your score page', 'I need to change the h1 and the intro paragraph so they describe what I am actually counting. How do I edit text in HTML?', 'CHANGE THIS: Your name and what you are counting'),
    legacyTask('TASK 2', 'Task 2 — Rename the button', 'I want to change the button label from + Add point to something that fits what I am counting. How do I change the text inside a button tag?', 'CHANGE THIS: The button labels'),
    legacyTask('TASK 3', 'Task 3 — Write your milestone messages', 'I want to write my own milestone messages that appear at score 5, 10, and 20. How do I change the text inside the if blocks?', 'CHANGE THIS: The milestone messages'),
    legacyTask('TASK 4', 'Task 4 — Add a new milestone', 'I want to add a milestone message at a score I pick myself, like 3 or 7. I can see a commented-out example — how do I uncomment it and change the number and message?', 'CHANGE THIS: your custom message at any score'),
    legacyTask('TASK 5', 'Task 5 — Change the accent color', 'I want to change the yellow color to something else. How do I update the CSS variable and find a hex code I like?', 'COLORS — change these to colors you like'),
  ] },
  { id: 4, title: 'Week #4 — Make It Hard', description: 'Add a timer and randomness to make your project challenging to beat.', templateFile: 'hard-game.html', tasks: [
    legacyTask('TASK 1', 'Task 1 — Name your game', 'I need to change the h1 and the description paragraph to match my game idea. How do I edit text inside HTML tags?', 'CHANGE THIS: Your game title and instructions'),
    legacyTask('TASK 2', 'Task 2 — Change the timer', 'I want to change how long the game lasts. I can see a variable called gameDuration — how do I change it to 5 seconds or 15 seconds?', 'CHANGE THIS: Game settings'),
    legacyTask('TASK 3', 'Task 3 — Write milestone messages', 'I want to write my own messages that appear when the player hits 5, 10, and 20 points. How do I change the text inside the if blocks?', 'CHANGE THIS: Milestone messages'),
    legacyTask('TASK 4', 'Task 4 — Make the target shrink (bonus)', 'There is a commented-out block that makes the target shrink as the score goes up. How do I uncomment those three lines to turn it on?', 'CHANGE THIS: make target smaller as score goes up'),
    legacyTask('TASK 5', 'Task 5 — Change the colors', 'I want to change the red accent color to match my game theme. How do I update the CSS variable at the top?', 'COLORS — change these to colors you like'),
  ] },
  { id: 5, title: 'Week #5 — Add the AI', description: 'Use fetch() to pull live content from the internet and show it on your page.', templateFile: 'ai-page.html', tasks: [
    legacyTask('TASK 1', 'Task 1 — Update your intro', 'I need to change the h1 and intro paragraph to describe what my page fetches. How do I edit text inside HTML tags?', 'CHANGE THIS: Your name and page description'),
    legacyTask('TASK 2', 'Task 2 — Change the joke display', 'Right now the joke shows setup + punchline joined with dots. I want to display them on separate lines. How do I use innerHTML to add a line break between them?', 'CHANGE THIS: how you display the result'),
    legacyTask('TASK 3', 'Task 3 — Change the quote section', 'I want to change the heading and description for the quote section to match my own idea. How do I edit the h2 and p tags?', 'CHANGE THIS: the section heading and description'),
    legacyTask('TASK 4', 'Task 4 — Change the placeholder text', 'I want to change the text that appears in both boxes before the user clicks. How do I find and edit the placeholder text inside the content-box divs?', 'CHANGE THIS: the placeholder text before clicking'),
    legacyTask('TASK 5', 'Task 5 — Change the accent color', 'I want to change the purple color to something that fits my page. How do I update the CSS variable?', 'COLORS — change these to colors you like'),
  ] },
  { id: 6, title: 'Week #6 — Solve a Real Problem', description: 'Build something that solves a real problem someone actually has. Then pitch it.', templateFile: 'my-project.html', tasks: [
    legacyTask('TASK 1', 'Task 1 — Name your project', 'I need to replace the placeholder title and my name in the h1 and subtitle. How do I edit those?', 'CHANGE THIS: Your project name in the title tab'),
    legacyTask('TASK 2', 'Task 2 — Describe the problem', 'I need to write 1–2 sentences describing the problem my project solves and who has it. Can you help me make it clear and specific?', 'CHANGE THIS: Describe the problem you are solving'),
    legacyTask('TASK 3', 'Task 3 — Build your solution', 'I want to delete the placeholder content inside the solution section and start building my actual project. What should I delete and where do I start?', 'YOUR PROJECT GOES HERE'),
    legacyTask('TASK 4', 'Task 4 — Write your next steps', "I need to fill in the 'If I had one more week' section with something honest and specific. Can you help me write one sentence?", 'CHANGE THIS: What you would add next'),
    legacyTask('TASK 5', 'Task 5 — Add project tags', 'I want to replace the placeholder tags with real labels that describe my project. How do I edit the text inside the span tags?', 'CHANGE THIS: Add tags that describe your project'),
  ] },
]

export function getLessonForProject(lessonId: number, lessonVersion: number | null) {
  const catalog = lessonVersion === CURRENT_LESSON_VERSION ? LESSONS : LEGACY_LESSONS
  return catalog.find((lesson) => lesson.id === lessonId) ?? null
}

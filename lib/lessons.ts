export type LessonTaskType = 'core' | 'choice' | 'bonus'

export const CURRENT_LESSON_VERSION = 2

export interface LessonTask {
  id: string
  type: LessonTaskType
  chip: string
  success: string
  prompt: string
  commentAnchor: string
}

export interface Lesson {
  id: number
  title: string
  description: string
  templateFile: string
  tasks: LessonTask[]
}

export const LESSONS: Lesson[] = [
  {
    id: 1,
    title: 'Week #1 — Profile Pop',
    description: 'Create a colorful profile card that makes your personality impossible to miss.',
    templateFile: 'personal-page.html',
    tasks: [
      { id: 'identity', type: 'core', chip: 'Write your intro', success: 'Your profile has your name and a one-line vibe.', prompt: 'Help me replace the name and short intro in my profile card with words that sound like me.', commentAnchor: 'TASK: identity' },
      { id: 'interests', type: 'core', chip: 'Pick your interests', success: 'Your interest chips match things you genuinely enjoy.', prompt: 'Show me how to replace or add one interest chip in my profile card.', commentAnchor: 'TASK: interests' },
      { id: 'palette', type: 'core', chip: 'Choose your colors', success: 'You changed the main colors to a palette you like.', prompt: 'Help me choose three colors and update the CSS variables for my profile card.', commentAnchor: 'TASK: palette' },
      { id: 'spotlight', type: 'choice', chip: 'Make it yours', success: 'Your spotlight card shares a hobby, dream, or fun fact.', prompt: 'Help me turn the spotlight card into something personal, like a hobby, dream, or fun fact.', commentAnchor: 'TASK: spotlight' },
      { id: 'mood', type: 'bonus', chip: 'Bonus: add a mood switch', success: 'Your button changes the profile mood or message.', prompt: 'Help me add a small button that changes the mood message on my profile.', commentAnchor: 'BONUS: mood switch' },
    ],
  },
  {
    id: 2,
    title: 'Week #2 — Vibe Mixer',
    description: 'Build a playful mood picker with buttons that instantly change the page.',
    templateFile: 'interactive-page.html',
    tasks: [
      { id: 'studio-name', type: 'core', chip: 'Name your studio', success: 'The title and welcome text describe your own vibe mixer.', prompt: 'Help me rename the Vibe Mixer and write a welcome line that fits my idea.', commentAnchor: 'TASK: studio name' },
      { id: 'vibes', type: 'core', chip: 'Create your vibe buttons', success: 'You chose at least three moods or energy levels.', prompt: 'Show me how to change the labels and emojis on the vibe buttons.', commentAnchor: 'TASK: vibe buttons' },
      { id: 'responses', type: 'core', chip: 'Write the responses', success: 'Every vibe button shows a message in your own voice.', prompt: 'Help me edit the JavaScript responses so each vibe has a fun message.', commentAnchor: 'TASK: vibe responses' },
      { id: 'theme', type: 'choice', chip: 'Make it yours', success: 'You styled the studio around a theme you chose.', prompt: 'Help me personalize this page with a theme such as space, sport, music, or nature.', commentAnchor: 'TASK: theme choice' },
      { id: 'surprise', type: 'bonus', chip: 'Bonus: surprise mode', success: 'A new button picks a random vibe for the visitor.', prompt: 'Help me add a Surprise me button that randomly chooses one of the vibes.', commentAnchor: 'BONUS: surprise mode' },
    ],
  },
  {
    id: 3,
    title: 'Week #3 — Streak Spark',
    description: 'Track a goal, build a streak, and celebrate progress with JavaScript.',
    templateFile: 'score-page.html',
    tasks: [
      { id: 'goal', type: 'core', chip: 'Choose a goal', success: 'Your tracker has a goal that matters to you.', prompt: 'Help me rename this streak tracker for a goal I care about, like reading, drawing, or practice.', commentAnchor: 'TASK: goal name' },
      { id: 'counter', type: 'core', chip: 'Customize the counter', success: 'Your action button and reset button fit your goal.', prompt: 'Show me how to change the button labels for my own goal tracker.', commentAnchor: 'TASK: counter labels' },
      { id: 'milestones', type: 'core', chip: 'Celebrate milestones', success: 'The app cheers for you at three progress milestones.', prompt: 'Help me write encouraging milestone messages for my goal tracker.', commentAnchor: 'TASK: milestones' },
      { id: 'reward', type: 'choice', chip: 'Make it yours', success: 'You added a reward or reason to keep going.', prompt: 'Help me customize the reward card with something that motivates me.', commentAnchor: 'TASK: reward choice' },
      { id: 'custom-milestone', type: 'bonus', chip: 'Bonus: add a milestone', success: 'Your own milestone appears at a number you chose.', prompt: 'Help me add a new JavaScript milestone at a number I choose.', commentAnchor: 'BONUS: custom milestone' },
    ],
  },
  {
    id: 4,
    title: 'Week #4 — Reflex Rush',
    description: 'Turn your code into an arcade-style reaction game with a timer and score.',
    templateFile: 'hard-game.html',
    tasks: [
      { id: 'game-name', type: 'core', chip: 'Name your game', success: 'Your game title and instructions explain how to play.', prompt: 'Help me rename my reaction game and write short instructions for players.', commentAnchor: 'TASK: game name' },
      { id: 'rules', type: 'core', chip: 'Set the challenge', success: 'You chose a timer length and a challenge level.', prompt: 'Show me how to change the game duration and target speed in the settings.', commentAnchor: 'TASK: game settings' },
      { id: 'score-messages', type: 'core', chip: 'Add score messages', success: 'Players see celebration messages as their score grows.', prompt: 'Help me write three energetic score messages for my game.', commentAnchor: 'TASK: score messages' },
      { id: 'arena', type: 'choice', chip: 'Make it yours', success: 'Your arena looks like a theme you picked.', prompt: 'Help me style the game arena around a theme I like, such as neon, jungle, or space.', commentAnchor: 'TASK: arena theme' },
      { id: 'hard-mode', type: 'bonus', chip: 'Bonus: hard mode', success: 'The target gets smaller or faster as the score rises.', prompt: 'Help me turn on and customize hard mode so the game gets tougher.', commentAnchor: 'BONUS: hard mode' },
    ],
  },
  {
    id: 5,
    title: 'Week #5 — Inspiration Lab',
    description: 'Use live APIs to bring jokes, quotes, and fresh ideas into your own app.',
    templateFile: 'ai-page.html',
    tasks: [
      { id: 'lab-name', type: 'core', chip: 'Name your lab', success: 'The intro explains what your live idea machine does.', prompt: 'Help me rename this Inspiration Lab and write a clear one-sentence description.', commentAnchor: 'TASK: lab name' },
      { id: 'joke-result', type: 'core', chip: 'Style live results', success: 'The first live result looks good before and after loading.', prompt: 'Help me customize the result text and loading message for the first API card.', commentAnchor: 'TASK: joke result' },
      { id: 'quote-result', type: 'core', chip: 'Customize the second feed', success: 'The second live card has a title and placeholder that fit your idea.', prompt: 'Show me how to edit the second API card title, description, and placeholder.', commentAnchor: 'TASK: quote result' },
      { id: 'collection', type: 'choice', chip: 'Make it yours', success: 'You created a collection title or theme for your discoveries.', prompt: 'Help me give this lab a personal theme, such as comedy, motivation, or creativity.', commentAnchor: 'TASK: collection choice' },
      { id: 'loading', type: 'bonus', chip: 'Bonus: better loading', success: 'The button gives friendly feedback while the API is loading.', prompt: 'Help me improve the loading state so a visitor knows the app is working.', commentAnchor: 'BONUS: loading state' },
    ],
  },
  {
    id: 6,
    title: 'Week #6 — Bright Idea',
    description: 'Pitch and prototype a small app that solves a real problem for someone.',
    templateFile: 'my-project.html',
    tasks: [
      { id: 'project-name', type: 'core', chip: 'Name your idea', success: 'Your project has a memorable name and a clear one-line promise.', prompt: 'Help me name my project and write a one-sentence promise for what it helps people do.', commentAnchor: 'TASK: project name' },
      { id: 'problem', type: 'core', chip: 'Describe the problem', success: 'You explain who has the problem and why it matters.', prompt: 'Help me write a short, specific problem statement for my project.', commentAnchor: 'TASK: problem statement' },
      { id: 'prototype', type: 'core', chip: 'Build the first feature', success: 'Your prototype button or interaction does something useful.', prompt: 'Help me replace the demo interaction with a simple first feature for my idea.', commentAnchor: 'TASK: first feature' },
      { id: 'pitch', type: 'choice', chip: 'Make it yours', success: 'Your pitch card makes someone want to try the project.', prompt: 'Help me make the pitch card sound exciting and clear for people who might use my app.', commentAnchor: 'TASK: pitch choice' },
      { id: 'next-step', type: 'bonus', chip: 'Bonus: next version', success: 'You added a realistic next feature to your project roadmap.', prompt: 'Help me add one realistic next feature I would build with another week.', commentAnchor: 'BONUS: next version' },
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

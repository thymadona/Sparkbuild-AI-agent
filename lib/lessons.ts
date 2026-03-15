export interface LessonTask {
  id: string;
  chip: string;
  prompt: string;
  commentAnchor: string;
}

export interface Lesson {
  id: number;
  title: string;
  description: string;
  templateFile: string;
  tasks: LessonTask[];
}

export const LESSONS: Lesson[] = [
  {
    id: 1,
    title: "Week #1 — My Personal Page",
    description:
      "Build your own personal webpage with a heading, styles, and a button.",
    templateFile: "personal-page.html",
    tasks: [
      {
        id: "TASK 1",
        chip: "Task 1 — Add your name",
        prompt:
          "I need to put my name in the <h1> tag and the <title> tag. How do I do that?",
        commentAnchor: "CHANGE THIS: Your name and one sentence about you",
      },
      {
        id: "TASK 2",
        chip: "Task 2 — Change your tags",
        prompt:
          "I want to update the interest tags to reflect my own hobbies. How do I add or remove a <span> tag?",
        commentAnchor: "CHANGE THIS: Add or remove tags that describe you",
      },
      {
        id: "TASK 3",
        chip: "Task 3 — Change the colors",
        prompt:
          "I want to change the background and accent colors using the CSS variables at the top. How do I pick a color and update the hex code?",
        commentAnchor: "COLORS — change these to colors you like",
      },
      {
        id: "TASK 4",
        chip: "Task 4 — Write about yourself",
        prompt:
          "I need to fill in the 'What I'm into right now' section with something I actually like. Can you help me write a couple of sentences?",
        commentAnchor: "CHANGE THIS: Write about something you love",
      },
      {
        id: "TASK 5",
        chip: "Task 5 — Add an image (bonus)",
        prompt:
          "I want to try the optional image section. How do I uncomment the <img> tag and use a real image URL?",
        commentAnchor: "THIS PART IS OPTIONAL",
      },
    ],
  },
  {
    id: 2,
    title: "Week #2 — Make It React",
    description:
      "Add buttons and JavaScript so your page responds when someone clicks.",
    templateFile: "interactive-page.html",
    tasks: [
      {
        id: "TASK 1",
        chip: "Task 1 — Update your intro",
        prompt:
          "I need to change the h1 and intro paragraph to say my name and describe what my page does. How do I edit text inside HTML tags?",
        commentAnchor: "CHANGE THIS: Your name and a short intro",
      },
      {
        id: "TASK 2",
        chip: "Task 2 — Change the secret message",
        prompt:
          "I want to change what appears inside the secret-box div when the button is clicked. How do I edit the text inside a div?",
        commentAnchor: "CHANGE THIS: The button label and secret message",
      },
      {
        id: "TASK 3",
        chip: "Task 3 — Add a mood option",
        prompt:
          "I want to add a fourth mood button called 'focused' with its own response message. How do I add a new button and add a new line to the responses object?",
        commentAnchor: "CHANGE THIS: Your mood options and responses",
      },
      {
        id: "TASK 4",
        chip: "Task 4 — Change the mood responses",
        prompt:
          "I want to rewrite the text responses for each mood so they sound like me. Where do I find the response text and how do I change it?",
        commentAnchor: "CHANGE THIS: The mood responses",
      },
      {
        id: "TASK 5",
        chip: "Task 5 — Change the accent color",
        prompt:
          "I want to change the green accent color to something that fits my style. How do I find a hex code and update the CSS variable?",
        commentAnchor: "COLORS — change these to colors you like",
      },
    ],
  },
  {
    id: 3,
    title: "Week #3 — Keep Score",
    description:
      "Use a variable to track a number that changes. Build something with a score, count, or progress.",
    templateFile: "score-page.html",
    tasks: [
      {
        id: "TASK 1",
        chip: "Task 1 — Name your score page",
        prompt:
          "I need to change the h1 and the intro paragraph so they describe what I am actually counting. How do I edit text in HTML?",
        commentAnchor: "CHANGE THIS: Your name and what you are counting",
      },
      {
        id: "TASK 2",
        chip: "Task 2 — Rename the button",
        prompt:
          'I want to change the button label from "+ Add point" to something that fits what I am counting. How do I change the text inside a button tag?',
        commentAnchor: "CHANGE THIS: The button labels",
      },
      {
        id: "TASK 3",
        chip: "Task 3 — Write your milestone messages",
        prompt:
          "I want to write my own milestone messages that appear at score 5, 10, and 20. How do I change the text inside the if blocks?",
        commentAnchor: "CHANGE THIS: The milestone messages",
      },
      {
        id: "TASK 4",
        chip: "Task 4 — Add a new milestone",
        prompt:
          "I want to add a milestone message at a score I pick myself, like 3 or 7. I can see a commented-out example — how do I uncomment it and change the number and message?",
        commentAnchor: "CHANGE THIS: your custom message at any score",
      },
      {
        id: "TASK 5",
        chip: "Task 5 — Change the accent color",
        prompt:
          "I want to change the yellow color to something else. How do I update the CSS variable and find a hex code I like?",
        commentAnchor: "COLORS — change these to colors you like",
      },
    ],
  },
  {
    id: 4,
    title: "Week #4 — Make It Hard",
    description:
      "Add a timer and randomness to make your project challenging to beat.",
    templateFile: "hard-game.html",
    tasks: [
      {
        id: "TASK 1",
        chip: "Task 1 — Name your game",
        prompt:
          "I need to change the h1 and the description paragraph to match my game idea. How do I edit text inside HTML tags?",
        commentAnchor: "CHANGE THIS: Your game title and instructions",
      },
      {
        id: "TASK 2",
        chip: "Task 2 — Change the timer",
        prompt:
          "I want to change how long the game lasts. I can see a variable called gameDuration — how do I change it to 5 seconds or 15 seconds?",
        commentAnchor: "CHANGE THIS: Game settings",
      },
      {
        id: "TASK 3",
        chip: "Task 3 — Write milestone messages",
        prompt:
          "I want to write my own messages that appear when the player hits 5, 10, and 20 points. How do I change the text inside the if blocks?",
        commentAnchor: "CHANGE THIS: Milestone messages",
      },
      {
        id: "TASK 4",
        chip: "Task 4 — Make the target shrink (bonus)",
        prompt:
          "There is a commented-out block that makes the target shrink as the score goes up. How do I uncomment those three lines to turn it on?",
        commentAnchor: "CHANGE THIS: make target smaller as score goes up",
      },
      {
        id: "TASK 5",
        chip: "Task 5 — Change the colors",
        prompt:
          "I want to change the red accent color to match my game theme. How do I update the CSS variable at the top?",
        commentAnchor: "COLORS — change these to colors you like",
      },
    ],
  },
  {
    id: 5,
    title: "Week #5 — Add the AI",
    description:
      "Use fetch() to pull live content from the internet and show it on your page.",
    templateFile: "ai-page.html",
    tasks: [
      {
        id: "TASK 1",
        chip: "Task 1 — Update your intro",
        prompt:
          "I need to change the h1 and intro paragraph to describe what my page fetches. How do I edit text inside HTML tags?",
        commentAnchor: "CHANGE THIS: Your name and page description",
      },
      {
        id: "TASK 2",
        chip: "Task 2 — Change the joke display",
        prompt:
          'Right now the joke shows setup + punchline joined with "...". I want to display them on separate lines. How do I use innerHTML to add a line break between them?',
        commentAnchor: "CHANGE THIS: how you display the result",
      },
      {
        id: "TASK 3",
        chip: "Task 3 — Change the quote section",
        prompt:
          "I want to change the heading and description for the quote section to match my own idea. How do I edit the h2 and p tags?",
        commentAnchor: "CHANGE THIS: the section heading and description",
      },
      {
        id: "TASK 4",
        chip: "Task 4 — Change the placeholder text",
        prompt:
          "I want to change the text that appears in both boxes before the user clicks. How do I find and edit the placeholder text inside the content-box divs?",
        commentAnchor: "CHANGE THIS: the placeholder text before clicking",
      },
      {
        id: "TASK 5",
        chip: "Task 5 — Change the accent color",
        prompt:
          "I want to change the purple color to something that fits my page. How do I update the CSS variable?",
        commentAnchor: "COLORS — change these to colors you like",
      },
    ],
  },
  {
    id: 6,
    title: "Week #6 — Solve a Real Problem",
    description:
      "Build something that solves a real problem someone actually has. Then pitch it.",
    templateFile: "my-project.html",
    tasks: [
      {
        id: "TASK 1",
        chip: "Task 1 — Name your project",
        prompt:
          "I need to replace the placeholder title and my name in the h1 and subtitle. How do I edit those?",
        commentAnchor: "CHANGE THIS: Your project name in the title tab",
      },
      {
        id: "TASK 2",
        chip: "Task 2 — Describe the problem",
        prompt:
          "I need to write 1–2 sentences describing the problem my project solves and who has it. Can you help me make it clear and specific?",
        commentAnchor: "CHANGE THIS: Describe the problem you are solving",
      },
      {
        id: "TASK 3",
        chip: "Task 3 — Build your solution",
        prompt:
          "I want to delete the placeholder content inside the solution section and start building my actual project. What should I delete and where do I start?",
        commentAnchor: "YOUR PROJECT GOES HERE",
      },
      {
        id: "TASK 4",
        chip: "Task 4 — Write your next steps",
        prompt:
          "I need to fill in the 'If I had one more week' section with something honest and specific. Can you help me write one sentence?",
        commentAnchor: "CHANGE THIS: What you would add next",
      },
      {
        id: "TASK 5",
        chip: "Task 5 — Add project tags",
        prompt:
          "I want to replace the placeholder tags with real labels that describe my project. How do I edit the text inside the span tags?",
        commentAnchor: "CHANGE THIS: Add tags that describe your project",
      },
    ],
  },
];

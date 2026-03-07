import { NextResponse } from 'next/server'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase-server'

// GET /api/projects — list all projects for the authenticated user
export async function GET() {
  const supabase = createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: projects, error } = await supabaseAdmin
    .from('projects')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(projects)
}

// POST /api/projects — create a new project
export async function POST(req: Request) {
  const supabase = createServerSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError) console.error('POST /api/projects auth error:', authError)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))

  const ADJECTIVES = ['Cosmic', 'Neon', 'Blazing', 'Turbo', 'Quantum', 'Solar', 'Arctic', 'Pixel', 'Hyper', 'Lunar']
  const NOUNS = ['Rocket', 'Panda', 'Wizard', 'Robot', 'Ninja', 'Dragon', 'Phoenix', 'Comet', 'Shark', 'Tiger']
  const randomTitle = `${ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]} ${NOUNS[Math.floor(Math.random() * NOUNS.length)]}`
  const title = body.title || randomTitle

  const { data: project, error } = await supabaseAdmin
    .from('projects')
    .insert({
      user_id: user.id,
      title,
      files: {
        'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Project</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="hero">
    <div class="sparkles" aria-hidden="true">
      <span>✦</span><span>✦</span><span>✦</span><span>✦</span><span>✦</span>
      <span>✦</span><span>✦</span><span>✦</span><span>✦</span><span>✦</span>
    </div>
    <h1>Your idea starts here ✦</h1>
    <p class="subtitle">Type a prompt in the chat and watch your project come to life.</p>
    <div class="ideas">
      <p class="ideas-label">Not sure what to build? Try one of these:</p>
      <div class="chips">
        <span class="chip">🎮 A quiz game</span>
        <span class="chip">⏱ A stopwatch</span>
        <span class="chip">🎨 A drawing canvas</span>
        <span class="chip">🌦 A weather card</span>
        <span class="chip">📝 A to-do list</span>
        <span class="chip">🎵 A music visualizer</span>
      </div>
    </div>
  </div>
  <script src="script.js"></script>
</body>
</html>`,
        'style.css': `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  min-height: 100vh;
  background: #0f0f1a;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: system-ui, sans-serif;
  color: #e2e8f0;
}

.hero {
  text-align: center;
  padding: 2rem;
  max-width: 560px;
  position: relative;
}

.sparkles {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.sparkles span {
  position: absolute;
  color: #6366f1;
  font-size: 1rem;
  opacity: 0;
  animation: float 4s ease-in-out infinite;
}

.sparkles span:nth-child(1)  { left: 5%;  top: 10%; animation-delay: 0s;    font-size: 0.6rem; }
.sparkles span:nth-child(2)  { left: 90%; top: 15%; animation-delay: 0.5s;  font-size: 0.9rem; }
.sparkles span:nth-child(3)  { left: 20%; top: 80%; animation-delay: 1s;    font-size: 0.7rem; }
.sparkles span:nth-child(4)  { left: 75%; top: 75%; animation-delay: 1.5s;  font-size: 1rem; }
.sparkles span:nth-child(5)  { left: 50%; top: 5%;  animation-delay: 2s;    font-size: 0.5rem; }
.sparkles span:nth-child(6)  { left: 10%; top: 45%; animation-delay: 2.5s;  font-size: 0.8rem; }
.sparkles span:nth-child(7)  { left: 85%; top: 50%; animation-delay: 0.8s;  font-size: 0.6rem; }
.sparkles span:nth-child(8)  { left: 35%; top: 90%; animation-delay: 1.8s;  font-size: 0.9rem; }
.sparkles span:nth-child(9)  { left: 60%; top: 88%; animation-delay: 3s;    font-size: 0.5rem; }
.sparkles span:nth-child(10) { left: 45%; top: 2%;  animation-delay: 3.5s;  font-size: 0.7rem; }

@keyframes float {
  0%   { opacity: 0; transform: translateY(0) scale(0.5); }
  30%  { opacity: 0.7; }
  70%  { opacity: 0.4; }
  100% { opacity: 0; transform: translateY(-40px) scale(1.2); }
}

h1 {
  font-size: 2rem;
  font-weight: 700;
  background: linear-gradient(135deg, #a5b4fc, #818cf8, #6366f1);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 0.75rem;
  line-height: 1.2;
}

.subtitle {
  color: #94a3b8;
  font-size: 0.95rem;
  margin-bottom: 2rem;
  line-height: 1.6;
}

.ideas-label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #475569;
  margin-bottom: 0.75rem;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: center;
}

.chip {
  background: #1e1e30;
  border: 1px solid #312e81;
  color: #a5b4fc;
  padding: 0.4rem 0.9rem;
  border-radius: 999px;
  font-size: 0.8rem;
  cursor: default;
  transition: border-color 0.2s, background 0.2s;
}

.chip:hover {
  background: #1e1b4b;
  border-color: #6366f1;
}`,
        'script.js': `// Your JavaScript goes here
// The AI will fill this in when you send a prompt

console.log('Project ready. Send a prompt to get started!');`,
      },
      is_public: false,
    })
    .select()
    .single()

  if (error) {
    console.error('POST /api/projects error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(project, { status: 201 })
}

// PATCH /api/projects — update title or is_public for a project
export async function PATCH(req: Request) {
  const supabase = createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { id, title, is_public, files } = body

  if (!id) {
    return NextResponse.json({ error: 'Project id is required' }, { status: 400 })
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (title !== undefined) updates.title = title
  if (is_public !== undefined) updates.is_public = is_public
  if (files !== undefined) updates.files = files

  // Ownership enforced by filtering on both id and user_id in the UPDATE itself
  const { data: project, error } = await supabaseAdmin
    .from('projects')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error || !project) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json(project)
}

// DELETE /api/projects — delete a project
export async function DELETE(req: Request) {
  const supabase = createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'Project id is required' }, { status: 400 })
  }

  // Ownership enforced by filtering on both id and user_id in the DELETE itself
  const { error } = await supabaseAdmin.from('projects').delete().eq('id', id).eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

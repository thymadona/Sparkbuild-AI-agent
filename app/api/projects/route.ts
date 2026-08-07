import { NextResponse } from 'next/server'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase-server'
import { CURRENT_LESSON_VERSION } from '@/lib/lessons'
import { getDisabledLessonIdsForUser } from '@/lib/lesson-availability'

// GET /api/projects — list all projects for the authenticated user
export async function GET() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: projects, error } = await supabaseAdmin
    .from('projects')
    .select('id, title, lesson_id, updated_at, is_public')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(projects)
}

// POST /api/projects — create a new project
export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient()
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
  const { templateHtml, lessonId, lessonVersion } = body

  if (typeof lessonId === 'number') {
    const disabledLessonIds = await getDisabledLessonIdsForUser(user.id)
    if (disabledLessonIds.has(lessonId)) {
      return NextResponse.json({ error: 'This lesson is not available for your class right now' }, { status: 403 })
    }
  }

  const insertData: Record<string, unknown> = {
    user_id: user.id,
    title,
    is_public: false,
  }
  if (lessonId !== undefined) {
    insertData.lesson_id = lessonId
    if (lessonVersion === CURRENT_LESSON_VERSION) insertData.lesson_version = CURRENT_LESSON_VERSION
  }

  if (templateHtml) {
    insertData.files = { 'index.html': templateHtml }
  } else {
    insertData.files = {
      'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Start Building</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      min-height: 100vh;
      background: #080812;
      font-family: system-ui, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      color: #fff;
    }

    canvas {
      position: fixed;
      inset: 0;
      pointer-events: none;
    }

    .card {
      position: relative;
      z-index: 1;
      text-align: center;
      padding: 2.5rem 2rem;
      max-width: 520px;
    }

    .badge {
      display: inline-block;
      font-size: 0.65rem;
      font-weight: 700;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: #a78bfa;
      background: rgba(139,92,246,0.12);
      border: 1px solid rgba(139,92,246,0.3);
      border-radius: 999px;
      padding: 0.3rem 0.9rem;
      margin-bottom: 1.4rem;
    }

    h1 {
      font-size: clamp(2rem, 6vw, 3rem);
      font-weight: 800;
      line-height: 1.15;
      margin-bottom: 1rem;
      background: linear-gradient(135deg, #fff 30%, #a78bfa 70%, #60a5fa);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    p {
      font-size: 1rem;
      color: #64748b;
      line-height: 1.7;
      margin-bottom: 2rem;
    }

    .ideas {
      display: flex;
      flex-wrap: wrap;
      gap: 0.6rem;
      justify-content: center;
      margin-bottom: 2rem;
    }

    .idea {
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 10px;
      padding: 0.55rem 1rem;
      font-size: 0.85rem;
      color: #cbd5e1;
      cursor: default;
      transition: border-color 0.2s, background 0.2s, transform 0.15s;
    }

    .idea:hover {
      border-color: rgba(139,92,246,0.5);
      background: rgba(139,92,246,0.08);
      transform: translateY(-2px);
    }

    .hint {
      font-size: 0.75rem;
      color: #334155;
      letter-spacing: 0.04em;
    }
  </style>
</head>
<body>
  <canvas id="c"></canvas>

  <div class="card">
    <span class="badge">Your canvas is ready</span>
    <h1>What will you<br>build today?</h1>
    <p>Type an idea in the chat and the AI turns it into real,<br>working code — instantly.</p>
    <div class="ideas">
      <span class="idea">🎮 Quiz game</span>
      <span class="idea">⏱ Countdown timer</span>
      <span class="idea">🎨 Drawing app</span>
      <span class="idea">🌦 Weather card</span>
      <span class="idea">📝 To-do list</span>
      <span class="idea">🎵 Music visualizer</span>
      <span class="idea">🐍 Snake game</span>
      <span class="idea">🌌 Starfield</span>
    </div>
    <p class="hint">Open the Chat panel and describe your idea &rarr;</p>
  </div>

  <script>
    const canvas = document.getElementById('c');
    const ctx = canvas.getContext('2d');
    let W, H, stars = [];

    function resize() {
      W = canvas.width  = window.innerWidth;
      H = canvas.height = window.innerHeight;
    }

    function init() {
      stars = Array.from({ length: 120 }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 1.2 + 0.2,
        speed: Math.random() * 0.3 + 0.05,
        opacity: Math.random(),
        dir: Math.random() > 0.5 ? 1 : -1,
      }));
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      const t = Date.now() / 1000;
      for (const s of stars) {
        const pulse = 0.4 + 0.6 * Math.abs(Math.sin(t * s.speed + s.opacity * 10));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = \`rgba(167,139,250,\${pulse * 0.7})\`;
        ctx.fill();
      }

      // subtle nebula glow
      const g = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, W * 0.55);
      g.addColorStop(0, 'rgba(99,102,241,0.06)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      requestAnimationFrame(draw);
    }

    resize();
    init();
    draw();
    window.addEventListener('resize', () => { resize(); init(); });
  </script>
</body>
</html>`,
    }
  }

  const { data: project, error } = await supabaseAdmin
    .from('projects')
    .insert(insertData)
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
  const supabase = await createServerSupabaseClient()
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
  const supabase = await createServerSupabaseClient()
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

  // Delete child rows first to avoid FK constraint violations
  await supabaseAdmin.from('messages').delete().eq('project_id', id)
  await supabaseAdmin.from('prompts').delete().eq('project_id', id)

  // Ownership enforced by filtering on both id and user_id in the DELETE itself
  const { error } = await supabaseAdmin.from('projects').delete().eq('id', id).eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

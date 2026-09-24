# Loaded by public/py-worker.js and by the Jest harness, so both run the
# exact same student-code glue. Files are already written to the cwd.
import sys, traceback, runpy, types, json, io

# --- Sparky's world -------------------------------------------------------
# Every printed line is something Sparky says, and `import sparky` gives the
# student a few more things to do. All of it is recorded as events, which feed
# the lessons' `worldContains` checks. Registered before _BASE_MODULES so it
# survives _reset.
_events = []


def _emit(kind, arg=''):
    if len(_events) < 300:  # a runaway loop must not fill the worker's memory
        _events.append([kind, arg])


sparky = types.ModuleType('sparky')
sparky.__doc__ = 'Sparky the robot. color(name), open_door(), close_door(), alarm(). Print makes Sparky talk.'
sys.modules['sparky'] = sparky


def _tool(fn):
    fn.__name__ = fn.__qualname__ = fn.__name__.lstrip('_')  # so errors say color(), not _color()
    setattr(sparky, fn.__name__, fn)
    return fn


@_tool
def _color(name):
    """Paint Sparky, e.g. sparky.color("pink")."""
    _emit('color', str(name))


@_tool
def _open_door():
    """Open the vault door."""
    _emit('door', 'open')


@_tool
def _close_door():
    """Close the vault door."""
    _emit('door', 'closed')


@_tool
def _alarm():
    """Sound the vault alarm."""
    _emit('alarm')


class _Tee:
    """Passes writes through to the real stdout and records each printed line as speech."""

    def __init__(self, inner):
        self._inner = inner
        self._buf = ''

    def write(self, s):
        self._buf += s
        while '\n' in self._buf:
            line, self._buf = self._buf.split('\n', 1)
            if line.strip():
                _emit('say', line)
        return self._inner.write(s)

    def finish(self):
        if self._buf.strip():
            _emit('say', self._buf)
        self._buf = ''

    def __getattr__(self, name):
        return getattr(self._inner, name)


def _events_json():
    return json.dumps(_events)


_BASE_MODULES = set(sys.modules)


def _reset():
    for m in [m for m in sys.modules if m not in _BASE_MODULES]:
        del sys.modules[m]
    if '.' not in sys.path:
        sys.path.insert(0, '.')


def _run(entry):
    """Run entry as a script. Prints a short traceback and returns False on error."""
    _reset()
    _events.clear()
    tee = _Tee(sys.stdout)
    sys.stdout = tee
    try:
        runpy.run_path(entry, run_name='__main__')
        return True
    except SystemExit:
        return True
    except BaseException as e:
        tb = e.__traceback__
        while tb and tb.tb_frame.f_code.co_filename.startswith(('/', '<')):
            tb = tb.tb_next
        traceback.print_exception(type(e), e, tb, file=sys.stderr)
        return False
    finally:
        tee.finish()
        sys.stdout = tee._inner


def _call(entry, expr):
    """Load entry as a module (no __main__ block) and return repr(eval(expr))."""
    _reset()
    ns = runpy.run_path(entry, run_name='student')
    return repr(eval(expr, ns))


MAX_STEPS = 200


class _Stop(BaseException):
    pass


def _shown(v):
    return not isinstance(v, (types.ModuleType, types.FunctionType, type))


def _trace(entry):
    """Run entry one line at a time. Returns JSON: [{line, stdout, callStack, vars}], at most MAX_STEPS.
    Each step is the state just BEFORE that line runs, like Python Tutor."""
    _reset()
    with open(entry) as f:
        code = compile(f.read(), '<trace>', 'exec')
    steps = []
    out = io.StringIO()

    def frame_vars(fr):
        scope = fr.f_globals if fr.f_code.co_name == '<module>' else fr.f_locals
        rows = []
        for k, v in list(scope.items()):
            if k.startswith('_') or not _shown(v):
                continue
            row = {'name': k, 'type': type(v).__name__, 'repr': repr(v)[:40]}
            if isinstance(v, (list, tuple)):
                row['items'] = [repr(x)[:20] for x in v[:12]]
            rows.append(row)
        return rows[:10]

    def local(frame, event, arg):
        if event == 'line':
            if len(steps) >= MAX_STEPS:
                raise _Stop()
            stack, fr = [], frame
            while fr and fr.f_code.co_filename == '<trace>':
                stack.append(fr.f_code.co_name)
                fr = fr.f_back
            steps.append({'line': frame.f_lineno, 'stdout': out.getvalue()[-500:], 'callStack': stack[::-1], 'vars': frame_vars(frame)})
        return local

    def glob(frame, event, arg):
        return local if frame.f_code.co_filename == '<trace>' else None

    real = sys.stdout
    sys.stdout = out
    sys.settrace(glob)
    try:
        exec(code, {'__name__': '__main__'})
    except (_Stop, SystemExit):
        pass
    except BaseException:
        traceback.print_exc(file=sys.stderr)
    finally:
        sys.settrace(None)
        sys.stdout = real
    return json.dumps(steps)

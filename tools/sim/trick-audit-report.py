#!/usr/bin/env python3
"""Turns tools/sim/trick-audit.js output into the Trick audit spreadsheet.

    python3 tools/sim/trick-audit-report.py MAIN.json [EXTRA.json] --out trick-audit.xlsx [--csv out.csv]

MAIN.json holds the loadout pass (and the run settings); EXTRA.json, when given,
holds the focus / time / hold / pairs passes. Everything printed in the sheet is
computed here from those files, except the per-Trick classification below
(what a Trick pays in) and the short plain-terms reads in NOTES.
"""
import argparse, json, math, statistics
from collections import defaultdict

import numpy as np
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.formatting.rule import ColorScaleRule
from openpyxl.utils import get_column_letter

TIERS = ['common', 'rare', 'epic', 'legendary']
TIER_WORD = {'common': 'Common', 'rare': 'Rare', 'epic': 'Epic', 'legendary': 'Legendary'}

# ── What each Trick pays in. Score = pips, mult, x pips, x mult, replays, primes,
# forced fires, or Focus applied twice (all of which move the hand's score).
FOCUS = {'river_run', 'overclock', 'high_pair', 'full_house_streak', 'two_pair_mult', 'before_the_tide',
         'quick_draw', 'first_play', 'frozen_moment', 'ticktock', 'wildfire', 'lucky_sevens', 'study_hall',
         'shape_square', 'shape_cross', 'groove', 'acorns', 'plan_ahead', 'meditation', 'tunnel_vision',
         'rhythm', 'cull', 'expanse', 'little_guys', 'life_lessons', 'third_down', 'clean_sweep'}
TIME = {'high_water', 'deluge', 'cuckoo', 'double_jeopardy', 'vulture', 'magpie', 'right_time', 'overtime',
        'rain_check', 'temporal_rift', 'five_second', 'wait_four_it', 'dam_holding'}
ECON = {'monochrome', 'mockingbird', 'starling', 'five_fodder', 'undue_influence', 'buried_treasure', 'release_valve'}
DEAD = {'wild_side': 'Pays per negative reward tile taken. Flow opens no reward grid, so it never pays there.',
        'wait_for_it': 'Pays per negative reward tile taken. Flow opens no reward grid, so it never pays there.'}
NOT_MEASURED = {'queens_upgrade': 'Raises card ranks over time (deck shaping); not scored by this test.',
                'aces_absorb': 'Removes cards and moves their buffs onto Aces (deck shaping); not scored by this test.'}
MIXED = {'richter': 'also +10 Focus on Four of a Kind', 'five_stack': 'also +1 Focus per card',
         'correct_run': 'one of +80 pips / +20 mult / +10 Focus', 'ninesong': 'one of rewind 9s / +9 mult / +9 Focus',
         'four_horseman': 'one of +16 pips / +8 mult / +4 Focus / 4s pause'}

# Numbers that rest on a setting rather than on the hand alone.
DEPENDS = {
    'nines_mult': 'held 48 hands; at most the deck\'s four 9s', 'compound_mult': 'held 48 hands',
    'tens_mult': 'held 48 hands; discards used', 'fives_discard': 'held 48 hands', 'relentless': 'held 48 hands',
    'feng_shui': 'held 48 hands; needs other marked lines', 'sapling': 'held 8 levels', 'first_fruits': 'held 8 levels',
    'sixes_perm': 'held 48 hands', 'fours_perm': 'held 48 hands', 'heartwood': 'held 48 hands', 'hourglass': 'held 48 hands',
    'rowcol_perm_double': 'held 48 hands; needs a marked row and column', 'rare_bloom': 'held 48 hands',
    'hummingbird': 'held 48 hands; needs pause sources', 'wellspring': 'Focus made all run (level 12)',
    'rising_tide': 'level 12', 'summit': 'level 12', 'club_double': 'clubs scored earlier in the level',
    'tide_table': 'Runs earlier in the level', 'combo_score': 'hand types earlier in the level',
    'shaky_foundation': 'Sets earlier in the level', 'kindling': 'same-hand streak', 'echo_hand': 'same-hand streak',
    'wave_amp': 'Run streak', 'swift': 'seconds into the level', 'sediment': 'seconds into the level',
    'still_water': 'seconds since your last swap', 'sands_of_time': 'clock left', 'spade_flood': 'clock left',
    'corner_retrigger': 'whole minutes left on the clock', 'early_bird': 'level start vs session clock',
    'night_owl': 'level start vs session clock', 'closing_time': 'level start vs session clock',
    'eye_of_storm': 'level start vs session clock', 'patience_reward': '15s+ gap between hands',
    'quarter_chime': 'clock marks passed between hands', 'second_hand': 'clock marks passed between hands',
    'minute_hand': 'clock marks passed between hands', 'interest': 'credits held (0-50)', 'obsessed': 'credits held (0-50)',
    'magician': '2 Sleights owned', 'scalper': '2 Sleight charges missing', 'portfolio': 'buffed cards on the board',
    'landfill': 'swaps and discards used', 'discard_pips': 'cards discarded', 'deep_breath': 'needs pause sources',
    'albatross': 'needs pause sources', 'kingfisher': 'needs pause or rewind sources', 'patient_rulers': 'needs a pause or rewind this level',
    'phoenix': 'needs pause sources', 'flow_state': 'Focus at x1.5 or more', 'hyper_focus': 'Focus level', 'kaleidoscope': 'Focus level', 'marathon': 'Focus level',
    'wild_heart': 'tray order; an Ace in the previous hand', 'prime_times': 'tray order; a prime in the previous hand',
    'twos_retrigger': 'tray order (forces the rightmost Trick)', 'mirror': 'its neighbours in the tray',
    'move_as_one': '3+ Tricks sharing a keyword', 'woodpecker': 'the marked card', 'assembly_line': 'cards from its line this level',
    'rowcol_triple_pips': 'its marked line', 'rowcol_mult': 'its marked line', 'rowcol_retrigger': 'its marked line',
    'perfect_timing': 'its marked line', 'four_by_four': 'the 4th column', 'feelin_lucky': 'its five rolled ranks',
}

# Plain-terms reads for the Tricks the doc discusses (written after the run).
NOTES = {}

def ptype(tid):
    if tid in DEAD: return 'Dead in Flow'
    if tid in NOT_MEASURED: return 'Not measured'
    if tid in FOCUS: return 'Focus'
    if tid in TIME: return 'Time'
    if tid in ECON: return 'Credits / stock'
    return 'Score'


def agg_loadouts(d):
    per = defaultdict(lambda: {'any': [], 'planned': []})
    for l in d['loadouts']:
        for mode in ('any', 'planned'):
            a = l[mode]
            for i, tid in enumerate(l['ids']):
                per[tid][mode].append(dict(h=a['hands'], pts=a['pts'][i], pips=a['pips'][i], mult=a['mult'][i],
                                           log=a['log'][i], fired=a['fired'][i], solo=a['solo'][i], last=a['last'][i],
                                           mx=a['max'][i], vL=a['vL'], v0=a['v0']))
    out = {}
    for tid, m in per.items():
        r = {}
        for mode, rows in m.items():
            H = sum(x['h'] for x in rows) or 1
            lg = sum(x['log'] for x in rows)
            fired = sum(x['fired'] for x in rows)
            per_lo = [x['log'] / max(1, x['h']) for x in rows]
            r[mode] = dict(
                loadouts=len(rows), hands=H,
                pts=sum(x['pts'] for x in rows) / H,
                pts_med=statistics.median([x['pts'] / max(1, x['h']) for x in rows]),
                pips=sum(x['pips'] for x in rows) / H, mult=sum(x['mult'] for x in rows) / H,
                pips_med=statistics.median([x['pips'] / max(1, x['h']) for x in rows]),
                mult_med=statistics.median([x['mult'] / max(1, x['h']) for x in rows]),
                log=lg / H, x=math.exp(lg / H), fire=fired / H,
                x_fired=math.exp(lg / fired) if fired else 1.0,
                solo=sum(x['solo'] for x in rows) / H, last=sum(x['last'] for x in rows) / H,
                mx=max(x['mx'] for x in rows),
                se=(statistics.stdev(per_lo) / math.sqrt(len(per_lo))) if len(per_lo) > 1 else 0.0,
                x_lo=math.exp(min(per_lo)), x_hi=math.exp(max(per_lo)),
            )
        out[tid] = r
    return out


def regression(d, ids):
    """Each loadout's average log score lift (all 5 Tricks vs none) regressed on
    which Tricks it held. A ridge fit, no intercept: no Tricks, no lift."""
    idx = {t: i for i, t in enumerate(ids)}
    X, y = [], []
    for l in d['loadouts']:
        a = l['any']
        row = np.zeros(len(ids))
        for t in l['ids']:
            if t in idx: row[idx[t]] = 1
        X.append(row); y.append((a['lvL'] - a['lv0']) / max(1, a['hands']))
    X, y = np.array(X), np.array(y)
    lam = 1.0
    beta = np.linalg.solve(X.T @ X + lam * np.eye(X.shape[1]), X.T @ y)
    fit = X @ beta
    r2 = 1 - ((y - fit) ** 2).sum() / ((y - y.mean()) ** 2).sum()
    return {t: float(beta[idx[t]]) for t in ids}, float(r2)


def fmt_x(v):
    return round(v, 2)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('main'); ap.add_argument('extra', nargs='?')
    ap.add_argument('--out', required=True); ap.add_argument('--csv'); ap.add_argument('--json')
    a = ap.parse_args()
    d = json.load(open(a.main))
    ex = json.load(open(a.extra)) if a.extra else {}
    for k in ('focus', 'time', 'hold', 'pairs', 'focusBase', 'levels'):
        if k in d and k not in ex: ex[k] = d[k]
    cfg = d['cfg']
    pool = d['pool']
    ids = [t['id'] for t in pool]
    tmeta = {t['id']: t for t in pool}
    L = agg_loadouts(d)
    beta, r2 = regression(d, ids)

    # Focus pass: the Focus multiplier each hand is scored at, vs no Trick.
    focus = {}
    if ex.get('focus'):
        base = next(r for r in ex['focus'] if r['id'] is None)
        for r in ex['focus']:
            if r['id'] is None: continue
            focus[r['id']] = dict(dmult=r['mult'] / base['mult'] - 1, dgen=r['gen'] - base['gen'], cap=r['cap'] - base['cap'],
                                  maxed=r['maxed'], mult=r['mult'])
        focus_base = base
    else:
        focus_base = None
    # Time pass.
    tim = {}
    if ex.get('time'):
        for r in ex['time']:
            if r['id'] is None: continue
            secs = r['pause'] + r['rewind']
            tim[r['id']] = dict(secs=secs, pause=r['pause'], rewind=r['rewind'], credits=r['credits'], swaps=r['swaps'],
                                discards=r['discards'], fire=r['fire'], note=r.get('note'), more_hands=secs / cfg['handSeconds'])

    # Levels pass: each Trick alone at level 4 / 12 / 24.
    lvl = {r['id']: r['levels'] for r in ex.get('levels', []) if r}

    # ── Rows ──
    rows = []
    for t in pool:
        tid = t['id']; ty = ptype(tid)
        A = L.get(tid, {}).get('any'); P = L.get(tid, {}).get('planned')
        row = dict(id=tid, name=t['name'], tier=t['tier'], desc=t['desc'], type=ty, depends=DEPENDS.get(tid, ''),
                   note=NOTES.get(tid) or DEAD.get(tid) or NOT_MEASURED.get(tid) or '', mixed=MIXED.get(tid, ''))
        if A:
            row.update(pts=A['pts_med'], pts_mean=A['pts'], pips=A['pips_med'], mult=A['mult_med'], pips_mean=A['pips'], mult_mean=A['mult'],
                       x_any=A['x'], fire_any=A['fire'], xf_any=A['x_fired'], se_any=A['se'],
                       solo=A['solo'], last=A['last'], mx_any=A['mx'], x_lo=A['x_lo'], x_hi=A['x_hi'], loadouts=A['loadouts'])
        if P:
            row.update(pts_plan=P['pts_med'], pts_plan_mean=P['pts'], x_plan=P['x'], fire_plan=P['fire'], xf_plan=P['x_fired'], mx_plan=P['mx'])
        row['reg_x'] = math.exp(beta.get(tid, 0.0))
        if tid in focus: row.update({'f_' + k: v for k, v in focus[tid].items()})
        if tid in lvl: row['lvl'] = lvl[tid]
        if tid in tim: row.update({'t_' + k: v for k, v in tim[tid].items()})
        # The one effect a non-score Trick is compared on, as a score multiplier.
        if ty == 'Focus' and tid in focus: row['eff'] = 1 + focus[tid]['dmult']
        elif ty == 'Time' and tid in tim: row['eff'] = 1 + tim[tid]['more_hands']
        elif ty == 'Credits / stock' and tid in tim: row['eff_credits'] = tim[tid]['credits']
        rows.append(row)

    # ── Rarity averages and ratios ──
    def lift(x): return x - 1
    avg = {}
    for ty in ('Score', 'Focus', 'Time'):
        for tier in TIERS + ['all']:
            key_any = 'x_any' if ty == 'Score' else 'eff'
            grp = [r for r in rows if r['type'] == ty and (tier == 'all' or r['tier'] == tier) and r.get(key_any) is not None]
            if not grp: continue
            a_any = statistics.mean(lift(r[key_any]) for r in grp)
            a_plan = statistics.mean(lift(r['x_plan']) for r in grp if r.get('x_plan')) if ty == 'Score' else None
            a_pts = statistics.mean(r['pts_mean'] for r in grp if 'pts_mean' in r) if ty == 'Score' else None
            avg[(ty, tier)] = dict(n=len(grp), any=a_any, plan=a_plan, pts=a_pts)
    for r in rows:
        ty = r['type']
        if ty == 'Score' and 'x_any' in r:
            g = avg[(ty, r['tier'])]
            r['ratio_any'] = lift(r['x_any']) / g['any'] if g['any'] else None
            r['ratio_plan'] = lift(r['x_plan']) / g['plan'] if g['plan'] else None
            r['ratio_pts'] = r['pts_mean'] / g['pts'] if g['pts'] else None
            r['ratio_basis'] = f"{TIER_WORD[r['tier']]} Score Tricks ({g['n']})"
        elif ty in ('Focus', 'Time') and r.get('eff') is not None:
            g = avg.get((ty, r['tier']))
            if not g or g['n'] < 3: g = avg[(ty, 'all')]; basis = f"all {ty} Tricks ({g['n']})"
            else: basis = f"{TIER_WORD[r['tier']]} {ty} Tricks ({g['n']})"
            r['ratio_any'] = lift(r['eff']) / g['any'] if g['any'] else None
            r['ratio_basis'] = basis
        rmax = max([v for v in (r.get('ratio_any'), r.get('ratio_plan')) if v is not None], default=None)
        if ty in ('Dead in Flow', 'Not measured'): r['flag'] = ty
        elif rmax is None: r['flag'] = '-'
        elif rmax >= 3: r['flag'] = 'Outlier'
        elif rmax >= 1.5: r['flag'] = 'High'
        elif rmax >= 0.67: r['flag'] = 'Normal'
        elif rmax >= 0.2: r['flag'] = 'Low'
        else: r['flag'] = 'Barely pays'

    # ── Pairs ──
    combos = []
    if ex.get('pairs'):
        singles = ex['pairs']['singles']
        for a_, b_, ilog, ipts, both, ptsb, pts0 in ex['pairs']['rows']:
            combos.append(dict(a=ids[a_], b=ids[b_], syn=math.exp(ilog), both=math.exp(both),
                               sa=math.exp(singles[a_]), sb=math.exp(singles[b_]), ipts=ipts))
        combos.sort(key=lambda c: -c['syn'])

    write_xlsx(a.out, rows, avg, combos, ex, cfg, d, r2, focus_base, tmeta)
    if a.csv:
        import csv
        cols = ['name', 'tier', 'type', 'flag', 'ratio_any', 'ratio_plan', 'pts', 'pips', 'mult', 'x_any', 'x_plan', 'fire_any', 'fire_plan', 'desc']
        with open(a.csv, 'w', newline='') as f:
            w = csv.writer(f); w.writerow(cols)
            for r in sorted(rows, key=lambda r: (r['type'], -(r.get('ratio_any') or 0))):
                w.writerow([r.get(c) if not isinstance(r.get(c), float) else round(r[c], 3) for c in cols])
    if a.json:
        json.dump(dict(rows=rows, avg={f'{k[0]}|{k[1]}': v for k, v in avg.items()}, combos=combos[:200], r2=r2,
                       focus_base=focus_base), open(a.json, 'w'))
    print('wrote', a.out, 'regression r2', round(r2, 3))


def write_xlsx(path, rows, avg, combos, ex, cfg, d, r2, focus_base, tmeta):
    wb = Workbook()
    hdr_fill = PatternFill('solid', fgColor='1F2A36'); hdr_font = Font(bold=True, color='FFFFFF')
    flag_fill = {'Outlier': 'F4B6B6', 'High': 'FBE3B0', 'Normal': 'FFFFFF', 'Low': 'DCE8F5', 'Barely pays': 'C9D9EE',
                 'Dead in Flow': 'D9D9D9', 'Not measured': 'EDEDED'}
    wrap = Alignment(wrap_text=True, vertical='top')
    top = Alignment(vertical='top')

    def sheet(ws, headers, data, widths, notes=None):
        r0 = 1
        if notes:
            for n in notes:
                ws.cell(row=r0, column=1, value=n).alignment = Alignment(wrap_text=False)
                r0 += 1
            r0 += 1
        for j, h in enumerate(headers, 1):
            c = ws.cell(row=r0, column=j, value=h); c.fill = hdr_fill; c.font = hdr_font
            c.alignment = Alignment(wrap_text=True, vertical='center')
        for i, rowv in enumerate(data, r0 + 1):
            for j, v in enumerate(rowv, 1):
                c = ws.cell(row=i, column=j, value=v)
                c.alignment = wrap if isinstance(v, str) and len(v) > 24 else top
        for j, w in enumerate(widths, 1): ws.column_dimensions[get_column_letter(j)].width = w
        ws.freeze_panes = ws.cell(row=r0 + 1, column=2)
        ws.auto_filter.ref = f"A{r0}:{get_column_letter(len(headers))}{r0 + len(data)}"
        return r0

    def pct(v): return None if v is None else round(v * 100, 1)
    def rnd(v, k=2): return None if v is None else round(v, k)

    # ── 1. Tricks ──
    ws = wb.active; ws.title = 'Tricks'
    order = {'Score': 0, 'Focus': 1, 'Time': 2, 'Credits / stock': 3, 'Dead in Flow': 4, 'Not measured': 5}
    data_rows = sorted(rows, key=lambda r: (order[r['type']], -(max(r.get('ratio_any') or -9, r.get('ratio_plan') or -9))))
    headers = ['Trick', 'Rarity', 'Description (as the game prints it)', 'Pays in', 'Flag',
               'Ratio vs rarity avg (any hand)', 'Ratio vs rarity avg (planned)',
               'Points added per hand (typical)', 'Pips added per hand', 'Mult added per hand',
               'Score multiplier (any hand)', 'Score multiplier (planned)',
               'Pays on % of hands (any)', 'Pays on % of hands (planned)', 'Multiplier when it pays (any)',
               'Focus / time / credit effect', 'Compared against', 'Rests on', 'Read']
    data = []
    for r in data_rows:
        other = ''
        if r['type'] == 'Focus' and 'f_dmult' in r:
            other = f"Focus multiplier {r['f_dmult'] * 100:+.1f}% on average; {r['f_dgen']:+.2f} Focus made a hand"
            if abs(r.get('f_cap', 0)) > 0.05: other += f"; Focus limit {r['f_cap']:+.1f} on average"
        elif r['type'] == 'Time' and 't_secs' in r:
            other = f"{r['t_secs']:+.2f} s a hand ({r['t_more_hands'] * 100:+.1f}% more hands in the same clock)"
            if r.get('t_note'): other += f"; {r['t_note']}"
        elif r['type'] == 'Credits / stock' and 't_credits' in r:
            bits = []
            if r['t_credits']: bits.append(f"{r['t_credits']:+.2f} credits a hand")
            if r['t_swaps']: bits.append(f"{r['t_swaps']:+.2f} swaps a hand")
            if r['t_discards']: bits.append(f"{r['t_discards']:+.2f} discards a hand")
            if r.get('t_secs'): bits.append(f"{r['t_secs']:+.2f} s a hand")
            if r.get('t_note'): bits.append(r['t_note'])
            other = '; '.join(bits)
        elif r['type'] == 'Score' and r.get('mixed'):
            fx = f"{r['f_dmult'] * 100:+.1f}% Focus" if 'f_dmult' in r else ''
            other = r['mixed'] + (f" (Focus side: {fx})" if fx else '')
        is_score = r['type'] == 'Score' and 'x_any' in r
        data.append([
            r['name'], TIER_WORD[r['tier']], r['desc'], r['type'], r['flag'],
            rnd(r.get('ratio_any')), rnd(r.get('ratio_plan')),
            rnd(r.get('pts'), 0) if is_score else None, rnd(r.get('pips'), 1) if is_score else None, rnd(r.get('mult'), 1) if is_score else None,
            rnd(r.get('x_any')) if is_score else rnd(r.get('eff')), rnd(r.get('x_plan')) if is_score else None,
            pct(r.get('fire_any')) if is_score else None, pct(r.get('fire_plan')) if is_score else None,
            rnd(r.get('xf_any')) if is_score else None,
            other, r.get('ratio_basis', ''), r['depends'], r['note'],
        ])
    r0 = sheet(ws, headers, data, [20, 10, 44, 11, 11, 11, 11, 11, 10, 10, 11, 11, 10, 10, 11, 40, 22, 26, 50], notes=[
        'Trick audit, Flow, level 12, 5x5 board. One row per Trick Flow can offer.',
        'Ratio: the Trick\'s score lift divided by the average lift of its rarity (Score Tricks), or of its kind (Focus, Time). 1 = average, 0.75 = a quarter weaker, 5 = five times the average.',
        'Score multiplier: how much the Trick multiplies a hand\'s score on average (x1.50 = +50%), with its share of any combo split fairly with its partners.',
        'Any hand = the same 1,000 hands for every loadout. Planned = the best hand on each board for that loadout.',
    ])
    n = len(data)
    for i in range(n):
        f = data[i][4]
        if f in flag_fill: ws.cell(row=r0 + 1 + i, column=5).fill = PatternFill('solid', fgColor=flag_fill[f])
    for col in ('F', 'G'):
        ws.conditional_formatting.add(f"{col}{r0 + 1}:{col}{r0 + n}", ColorScaleRule(
            start_type='num', start_value=0, start_color='DCE8F5', mid_type='num', mid_value=1, mid_color='FFFFFF',
            end_type='num', end_value=4, end_color='F08080'))
    ws.row_dimensions[r0].height = 45

    # ── 2. Rarity averages ──
    ws = wb.create_sheet('Rarity averages')
    data = []
    for (ty, tier), g in sorted(avg.items(), key=lambda kv: (kv[0][0], (TIERS + ['all']).index(kv[0][1]))):
        data.append([ty, 'All' if tier == 'all' else TIER_WORD[tier], g['n'], rnd(1 + g['any']),
                     rnd(1 + g['plan']) if g['plan'] is not None else None, rnd(g['pts'], 0) if g['pts'] is not None else None])
    sheet(ws, ['Pays in', 'Rarity', 'Tricks', 'Average multiplier (any hand)', 'Average multiplier (planned)',
               'Average points added per hand (mean)'], data, [14, 12, 8, 16, 16, 18],
          notes=['The averages each ratio is measured against. Dead and unmeasured Tricks are left out.',
                 'Focus and Time rows: the multiplier is the score the effect is worth (Focus multiplier, or more hands in the same clock).'])

    # ── 3. Combos ──
    if combos:
        ws = wb.create_sheet('Combos')
        nm = lambda i: tmeta[i]['name']
        data = [[nm(c['a']), nm(c['b']), rnd(c['syn']), rnd(c['sa']), rnd(c['sb']), rnd(c['both']), rnd(c['sa'] * c['sb'])]
                for c in combos[:60]]
        sheet(ws, ['Trick A', 'Trick B', 'Extra multiplier together', 'A alone', 'B alone', 'Both together', 'A x B (if they did not interact)'],
              data, [22, 22, 14, 10, 10, 12, 16],
              notes=['Every pair of Tricks scored alone together on 200 shared hands. Extra multiplier = both together / (A alone x B alone).',
                     'Above 1: the pair feeds itself (one makes the other\'s condition, replays feed a per-replay multiplier...). The top 60 pairs.'])

    # ── 4. Scaling over time ──
    if ex.get('hold'):
        ws = wb.create_sheet('Scaling over time')
        holds = [h['H'] for h in ex['hold'][0]['holds']]
        data = []
        for hrec in ex['hold']:
            data.append([tmeta[hrec['id']]['name'], TIER_WORD[tmeta[hrec['id']]['tier']]] + [rnd(h['mult']) for h in hrec['holds']]
                        + [rnd(v, 0) for v in hrec['byJ']])
        sheet(ws, ['Trick', 'Rarity'] + [f'x after {h} hands' for h in holds] + [f'points, hand {j + 1} of level' for j in range(cfg['handsPerLevel'])],
              data, [22, 10] + [11] * len(holds) + [11] * cfg['handsPerLevel'],
              notes=['Each Trick alone. Score multiplier by how long it has been held, and points added by where the hand falls in a 6-hand level.'])

    # ── 4b. By level ──
    lv_rows = [r for r in rows if r.get('lvl') and r['type'] == 'Score']
    if lv_rows:
        ws = wb.create_sheet('By level')
        levels = [x['level'] for x in lv_rows[0]['lvl']]
        data = []
        for r in sorted(lv_rows, key=lambda r: (r['lvl'][-1]['mult'] - 1) / max(1e-9, r['lvl'][0]['mult'] - 1) if r['lvl'][0]['mult'] > 1.001 else 9):
            m = [x['mult'] for x in r['lvl']]
            keep = (m[-1] - 1) / (m[0] - 1) if m[0] > 1.001 else None
            data.append([r['name'], TIER_WORD[r['tier']]] + [rnd(v) for v in m] + [pct(keep)])
        sheet(ws, ['Trick', 'Rarity'] + [f'x alone, level {lv}' for lv in levels] + [f'% of its level-{levels[0]} lift kept at level {levels[-1]}'],
              data, [22, 10] + [12] * len(levels) + [16],
              notes=['Each Trick alone, on the same 1,000 hands, at three points in a run. Base pips grow 10% a level and base mult does not,',
                     'so a flat +pips Trick is worth less every level while a flat +mult Trick holds its value.'])

    # ── 5. Focus run ──
    if focus_base:
        ws = wb.create_sheet('Focus run')
        data = []
        for r in sorted([r for r in rows if 'f_dmult' in r], key=lambda r: -r['f_dmult']):
            if abs(r['f_dmult']) < 1e-4 and abs(r['f_dgen']) < 1e-4: continue
            data.append([r['name'], TIER_WORD[r['tier']], r['type'], pct(r['f_dmult']), rnd(r['f_mult']), rnd(r['f_dgen']), rnd(r['f_cap'], 1), pct(r['f_maxed'])])
        sheet(ws, ['Trick', 'Rarity', 'Pays in', 'Focus multiplier change %', 'Average Focus multiplier', 'Focus made a hand (+/-)',
                   'Focus limit change', '% of hands at the limit'], data, [22, 10, 12, 14, 14, 14, 12, 12],
              notes=[f"No Trick: Focus multiplier x{focus_base['mult']:.2f} on average, at the limit on {focus_base['maxed'] * 100:.0f}% of hands, "
                     f"{focus_base['gen']:.2f} Focus made a hand. 150 runs of 8 levels, 6 hands a level, one Trick held."])

    # ── 6. Detail ──
    ws = wb.create_sheet('Detail')
    headers = ['Trick', 'Rarity', 'Pays in', 'Loadouts', 'Points mean (any)', 'Points median of loadouts (any)', 'Pips mean', 'Mult mean',
               'Multiplier (any)', 'Std error (log)', 'Lowest loadout x', 'Highest loadout x', 'Alone: points added', 'Added last: points',
               'Biggest single-hand share (any)', 'Points mean (planned)', 'Multiplier (planned)', 'Biggest single-hand share (planned)',
               'Regression multiplier', 'Ratio on points basis']
    data = []
    for r in sorted(rows, key=lambda r: r['name'].lower()):
        if 'x_any' not in r: continue
        data.append([r['name'], TIER_WORD[r['tier']], r['type'], r.get('loadouts'), rnd(r.get('pts_mean'), 0), rnd(r.get('pts'), 0),
                     rnd(r.get('pips_mean'), 1), rnd(r.get('mult_mean'), 1), rnd(r.get('x_any'), 3), rnd(r.get('se_any'), 3),
                     rnd(r.get('x_lo')), rnd(r.get('x_hi')), rnd(r.get('solo'), 0), rnd(r.get('last'), 0), rnd(r.get('mx_any'), 0),
                     rnd(r.get('pts_plan_mean'), 0), rnd(r.get('x_plan'), 3), rnd(r.get('mx_plan'), 0), rnd(r.get('reg_x'), 3), rnd(r.get('ratio_pts'))])
    sheet(ws, headers, data, [22, 10, 12, 9] + [12] * 16,
          notes=[f'Regression check: each loadout\'s average log lift regressed on the Tricks it held explains {r2 * 100:.0f}% of the variation between loadouts.',
                 'Points mean is pulled up by a few huge hands; the Tricks sheet shows the median over the Trick\'s 30 loadouts.'])

    # ── 7. Settings ──
    ws = wb.create_sheet('Settings')
    explain = {
        'level': 'Flow level the hands are scored at', 'quarter': 'Quarter (QRL: buffs, replay and prime sources per card)',
        'grids': 'Random 5x5 boards, shared by every loadout', 'handsPerGrid': 'Hands per board (each in its own round state)',
        'handsPerLevel': 'Hands it takes to clear a level', 'sessionSeconds': "Flow's clock to the boss",
        'levelStartMin': 'Fewest seconds left on that clock when a level starts', 'handSeconds': 'Average seconds between hands',
        'minGap': 'Fastest gap between hands', 'swapChance': 'Chance of a swap before a hand', 'discardChance': 'Chance of a discard before a hand',
        'cardsPerDiscard': 'Cards per discard', 'coinsMax': 'Credits held: 0 to this', 'holdHands': 'Hands a scaling Trick has been held',
        'focusPerHand': 'Focus made per hand (measured)', 'stockHeld': 'Swaps + discards held (Hoarder House)',
        'sleightsOwned': 'Sleights owned (Magician)', 'sleightChargesMissing': 'Sleight charges missing (Scalper)',
        'baseBuffPips': 'Deck cards with +pips', 'baseBuffPipsAmt': '... pips each', 'baseBuffMult': 'Deck cards with +mult',
        'baseBuffMultAmt': '... mult each', 'focusLevels': 'Focus run: levels per run', 'focusRuns': 'Focus run: runs per Trick', 'seed': 'Random seed',
    }
    data = [[k, cfg[k] if not isinstance(cfg[k], (list, dict)) else 'from the Focus run', explain.get(k, '')] for k in cfg if k != 'focusDist']
    data.append(['loadouts', len(d['loadouts']), 'Random 5-Trick loadouts (every Trick in the same number)'])
    sheet(ws, ['Setting', 'Value', 'What it is'], data, [22, 14, 60])

    wb.save(path)


if __name__ == '__main__':
    main()

from __future__ import annotations

from collections import Counter, defaultdict

from backend import db


async def generate_trade_insights(user_id, period="weekly", section="all") -> dict:
    try:
        trades = db.get_hl_trade_history(user_id, limit=200)
        if section != 'all':
            trades = [trade for trade in trades if trade.get('section', 'perps') == section]

        by_hour = defaultdict(list)
        by_pair = defaultdict(list)
        by_grade = defaultdict(list)
        losses = []
        for trade in trades:
            pnl = float(trade.get('pnl', 0) or 0)
            pair = trade.get('pair', 'UNKNOWN')
            hour = str(trade.get('hour_utc') or trade.get('timestamp', '13:00 UTC'))[:5] + ' UTC'
            grade = str(trade.get('grade', 'A'))
            by_hour[hour].append(pnl)
            by_pair[pair].append(pnl)
            by_grade[grade].append(pnl)
            if pnl < 0:
                losses.append(trade.get('reason', 'late entry'))

        def _best_key(bucket):
            if not bucket:
                return '-'
            return max(bucket, key=lambda k: (sum(bucket[k]) / max(len(bucket[k]), 1)))

        def _worst_key(bucket):
            if not bucket:
                return '-'
            return min(bucket, key=lambda k: (sum(bucket[k]) / max(len(bucket[k]), 1)))

        best_hour = _best_key(by_hour)
        weakest_pair = _worst_key(by_pair)
        best_grade = _best_key(by_grade)
        common_loss = Counter(losses).most_common(1)[0][0] if losses else 'none'
        risk_compliance = round((len([t for t in trades if float(t.get('risk_used', 1) or 1) <= 1]) / max(len(trades), 1)) * 100, 2)

        summary = (
            f"Across {len(trades)} trades, your strongest window is {best_hour} and weakest pair is {weakest_pair}. "
            f"Best grading cluster is {best_grade}. Risk compliance sits at {risk_compliance}% with common loss pattern: {common_loss}."
        )

        insight = {
            'user_id': user_id,
            'period': period,
            'section': section,
            'summary': summary,
            'best_hour': best_hour,
            'weakest_pair': weakest_pair,
            'best_grade': best_grade,
            'suggestions': [
                'Reduce size during weak pair regimes.',
                'Prioritize trades during your best performance hour.',
                'Avoid entries when setup quality is below your baseline.',
            ],
        }
        db._upsert('ai_insights', insight, on_conflict='user_id')
        return insight
    except Exception:
        return {
            'user_id': user_id,
            'period': period,
            'section': section,
            'summary': 'Insufficient data for insight generation.',
            'best_hour': '-',
            'weakest_pair': '-',
            'best_grade': '-',
            'suggestions': [],
        }


async def analyze_missed_setups(user_id) -> list:
    try:
        dismissed = db._select_many('pending_signals', user_id=user_id, status='dismissed', order='dismissed_at', desc=True, limit=25)
        results = []
        for row in dismissed:
            move = float(row.get('post_move_percent', 0.8) or 0.8)
            if abs(move) > 0.5:
                results.append({
                    'pair': row.get('pair', 'UNKNOWN'),
                    'direction': row.get('direction', 'long'),
                    'missed_pnl_percent': round(move, 2),
                })
        return results
    except Exception:
        return []

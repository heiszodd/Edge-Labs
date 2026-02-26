import { useState } from 'react';
import { DragDropContext, Draggable, Droppable } from 'react-beautiful-dnd';
import TierGuard from '../components/common/TierGuard';
import CandlestickChart from '../components/charts/CandlestickChart';

const tabs = ['Overview', 'Positions', 'Orders', 'Scanner', 'Models', 'Pending', 'Demo', 'Risk'];
const initial = { available: ['BOS confirm', 'Liquidity sweep', 'FVG reclaim'], phase1: [], phase2: [], phase3: [], phase4: [] };

function ModelBuilder() {
  const [state, setState] = useState(initial);
  const onDragEnd = ({ source, destination }) => {
    if (!destination) return;
    const sourceItems = [...state[source.droppableId]];
    const [moved] = sourceItems.splice(source.index, 1);
    const destItems = source.droppableId === destination.droppableId ? sourceItems : [...state[destination.droppableId]];
    destItems.splice(destination.index, 0, moved);
    setState({ ...state, [source.droppableId]: sourceItems, [destination.droppableId]: destItems });
  };
  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="grid md:grid-cols-5 gap-3">
        {Object.keys(state).map((key) => (
          <Droppable droppableId={key} key={key}>
            {(provided) => (
              <div className="card min-h-40" ref={provided.innerRef} {...provided.droppableProps}>
                <h4 className="font-medium mb-2 capitalize">{key}</h4>
                {state[key].map((r, idx) => (
                  <Draggable draggableId={`${key}-${r}-${idx}`} index={idx} key={`${key}-${r}-${idx}`}>
                    {(drag) => <div ref={drag.innerRef} {...drag.draggableProps} {...drag.dragHandleProps} className="bg-zinc-700 rounded p-2 mb-2 text-sm">{r}</div>}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        ))}
      </div>
    </DragDropContext>
  );
}

export default function Perps() {
  const [tab, setTab] = useState('Overview');
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Perps</h1>
      <div className="flex flex-wrap gap-2">{tabs.map((t) => <button key={t} className={`btn ${tab === t ? 'bg-violet-500' : 'bg-zinc-800'}`} onClick={() => setTab(t)}>{t}</button>)}</div>
      {tab === 'Overview' && <div className="grid md:grid-cols-2 gap-4"><div className="card">HL Account: Balance $13,221 · Margin Used $1,030 · uPnL +$222</div><CandlestickChart /></div>}
      {tab === 'Positions' && <div className="card overflow-x-auto"><table className="w-full text-sm"><thead><tr><th>Coin</th><th>Side</th><th>uPnL</th><th>Actions</th></tr></thead><tbody><tr><td>BTC</td><td>Long</td><td className="text-emerald-500">+3.1%</td><td className="space-x-2"><button className="btn bg-zinc-700">Close 25%</button><button className="btn bg-zinc-700">Close 50%</button><button className="btn bg-red-500">Close All</button></td></tr></tbody></table></div>}
      {tab === 'Scanner' && <TierGuard tier="pro"><div className="card"><button className="btn bg-violet-500">▶️ Run Scanner</button><p className="text-zinc-400 mt-2">Recent signals available.</p></div></TierGuard>}
      {tab === 'Models' && <div className="space-y-3"><div className="card">Model list + create/edit actions</div><ModelBuilder /></div>}
      {tab === 'Pending' && <div className="card">Signal cards (Phase 3+/4) with execute/demo/dismiss.</div>}
      {tab === 'Demo' && <div className="card">Demo Panel: balance, deposit, reset, open trades, history.</div>}
      {tab === 'Risk' && <div className="card">Risk sliders and warning thresholds.</div>}
    </div>
  );
}

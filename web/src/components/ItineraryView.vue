<script setup lang="ts">
// Structured output: first the raw, schema-valid JSON, then the SAME data rendered as a UI.
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useRunStore } from '../stores/run';

const run = useRunStore();
const it = computed(() => run.itinerary);
const showCards = ref(false);
let timer: ReturnType<typeof setTimeout> | undefined;

watch(
  () => run.showItinerary,
  (open) => {
    clearTimeout(timer);
    showCards.value = false;
    // Let the audience see the JSON for a moment, then morph it into day cards.
    if (open) timer = setTimeout(() => (showCards.value = true), 2500 / run.speed);
  },
);
onBeforeUnmount(() => clearTimeout(timer));

const weatherIcon = (summary: string, rainy: boolean) =>
  rainy ? '🌧️' : /snow/i.test(summary) ? '❄️' : /clear|sun/i.test(summary) ? '☀️' : /fog/i.test(summary) ? '🌫️' : '☁️';
const eur = (n: number) => `€${Math.round(n).toLocaleString()}`;
const within = computed(() => (it.value ? it.value.budget.totalEur <= it.value.budget.limitEur : true));
</script>

<template>
  <Transition name="fade">
    <div v-if="run.showItinerary && it" class="backdrop" @click.self="run.showItinerary = false">
      <div class="sheet">
        <header>
          <div>
            <h2>{{ it.origin }} → {{ it.destination }}</h2>
            <div class="dates">{{ it.startDate }} – {{ it.endDate }} · {{ it.id }}</div>
          </div>
          <div class="tabs">
            <button :class="{ on: !showCards }" @click="showCards = false">{ } JSON</button>
            <button :class="{ on: showCards }" @click="showCards = true">Cards</button>
            <button @click="run.showItinerary = false">✕</button>
          </div>
        </header>

        <Transition name="morph" mode="out-in">
          <pre v-if="!showCards" key="json" class="json">{{ JSON.stringify(it, null, 2) }}</pre>

          <div v-else key="cards" class="cards">
            <section class="summary">
              <div class="box">
                <h3>✈️ Transport</h3>
                <p><b>Out</b> {{ it.transport.outbound.carrier }} · {{ it.transport.outbound.depart }} → {{ it.transport.outbound.arrive }} · {{ eur(it.transport.outbound.priceEur) }}</p>
                <p><b>Back</b> {{ it.transport.inbound.carrier }} · {{ it.transport.inbound.depart }} → {{ it.transport.inbound.arrive }} · {{ eur(it.transport.inbound.priceEur) }}</p>
              </div>
              <div class="box">
                <h3>🏨 Stay</h3>
                <p><b>{{ it.hotel.name }}</b></p>
                <p>{{ it.hotel.nights }} nights × {{ eur(it.hotel.pricePerNightEur) }} = {{ eur(it.hotel.totalEur) }}</p>
              </div>
              <div :class="['box', 'budget', { over: !within }]">
                <h3>💶 Budget</h3>
                <table>
                  <tr><td>Transport</td><td>{{ eur(it.budget.transportEur) }}</td></tr>
                  <tr><td>Stay</td><td>{{ eur(it.budget.stayEur) }}</td></tr>
                  <tr><td>Activities</td><td>{{ eur(it.budget.activitiesEur) }}</td></tr>
                  <tr><td>Food</td><td>{{ eur(it.budget.foodEur) }}</td></tr>
                  <tr class="total"><td>Total</td><td>{{ eur(it.budget.totalEur) }} / {{ eur(it.budget.limitEur) }}</td></tr>
                </table>
              </div>
            </section>

            <section class="days">
              <article v-for="(d, i) in it.days" :key="d.day" class="day" :style="{ animationDelay: `calc(${i} * 150ms / var(--speed))` }">
                <div class="day-head">
                  <span class="wx">{{ weatherIcon(d.weather.summary, d.weather.rainy) }}</span>
                  <div>
                    <div class="day-n">Day {{ d.day }}</div>
                    <div class="day-date">{{ d.date }}</div>
                  </div>
                  <div class="temp">{{ Math.round(d.weather.tempMinC) }}–{{ Math.round(d.weather.tempMaxC) }}°C</div>
                </div>
                <div class="wx-sum">{{ d.weather.summary }}</div>
                <ul>
                  <li v-for="a in d.activities" :key="a.time + a.name">
                    <span class="time">{{ a.time }}</span>
                    <span class="name">{{ a.name }}</span>
                    <span class="io" :title="a.indoor ? 'indoor' : 'outdoor'">{{ a.indoor ? '🏛️' : '🌳' }}</span>
                    <span class="cost">{{ a.costEur ? eur(a.costEur) : 'free' }}</span>
                  </li>
                </ul>
              </article>
            </section>

            <ul v-if="it.notes.length" class="notes">
              <li v-for="n in it.notes" :key="n">{{ n }}</li>
            </ul>
          </div>
        </Transition>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.backdrop { position: fixed; inset: 0; background: rgb(0 0 0 / 0.6); display: grid; place-items: center; z-index: 40; padding: 16px; }
.sheet {
  width: min(1400px, 100%);
  max-height: 92vh;
  display: flex;
  flex-direction: column;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 14px;
  overflow: hidden;
}
header { display: flex; justify-content: space-between; align-items: center; padding: 14px 18px; border-bottom: 1px solid var(--border); gap: 12px; flex-wrap: wrap; }
h2 { margin: 0; }
.dates { color: var(--muted); font-size: 13px; }
.tabs { display: flex; gap: 6px; }
.tabs .on { background: var(--accent); color: #0d0f14; border-color: var(--accent); }
.json { margin: 0; padding: 16px 18px; overflow: auto; font-size: 13px; color: #c9cede; }
.cards { overflow: auto; padding: 16px 18px; display: flex; flex-direction: column; gap: 14px; }
.summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; }
.box { background: var(--panel-2); border-radius: 10px; padding: 12px 14px; }
.box h3 { margin: 0 0 6px; font-size: 15px; }
.box p { margin: 3px 0; font-size: 14px; }
.budget table { width: 100%; font-size: 14px; border-collapse: collapse; }
.budget td:last-child { text-align: right; font-family: ui-monospace, Consolas, monospace; }
.budget .total td { border-top: 1px solid var(--border); padding-top: 4px; font-weight: 700; color: var(--c-assistant); }
.budget.over .total td { color: var(--c-error); }
.days { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; }
.day { background: var(--panel-2); border-radius: 10px; padding: 12px; border-top: 3px solid var(--accent); animation: rise var(--t-med) ease-out both; }
.day-head { display: flex; gap: 10px; align-items: center; }
.wx { font-size: 30px; }
.day-n { font-weight: 700; }
.day-date { color: var(--muted); font-size: 12px; }
.temp { margin-left: auto; font-weight: 600; }
.wx-sum { color: var(--muted); font-size: 12px; margin: 4px 0 8px; }
.day ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 5px; }
.day li { display: flex; gap: 6px; font-size: 13px; align-items: baseline; }
.time { color: var(--muted); font-family: ui-monospace, Consolas, monospace; font-size: 12px; }
.name { flex: 1; }
.cost { font-family: ui-monospace, Consolas, monospace; font-size: 12px; color: var(--c-tool_use); }
.notes { color: var(--muted); font-size: 13px; margin: 0; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.fade-enter-active, .fade-leave-active { transition: opacity var(--t-med); }
.morph-enter-from { opacity: 0; transform: scale(0.97); filter: blur(4px); }
.morph-leave-to { opacity: 0; transform: scale(1.02); filter: blur(4px); }
.morph-enter-active, .morph-leave-active { transition: all var(--t-med) ease; }
@keyframes rise { from { opacity: 0; transform: translateY(14px); } }
</style>

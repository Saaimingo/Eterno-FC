"use client";

import { type ChangeEvent, type CSSProperties, useEffect, useRef, useState } from "react";
import {
  acceptBid,
  acceptJob,
  applyForJob,
  buildMatchPlan,
  buyPlayer,
  clubById,
  competitionById,
  competitionTable,
  createNewGame,
  finishRound,
  formatGameDate,
  formatMoney,
  getAvailableClubs,
  migrateGame,
  nextUserFixture,
  promoteYouth,
  rejectBid,
  resignJob,
  scoutProspect,
  seasonIsOver,
  sellPlayer,
  squadFor,
  startNextSeason,
  transferWindow,
  toggleStarter,
  toggleJobOffers,
  upgradeAcademy,
  userClub,
  userLeague,
  type Club,
  type GameState,
  type MatchPlan,
  type Player,
} from "./game";

const STORAGE_KEY = "eterno-fc-careers-v2";
const LEGACY_STORAGE_KEY = "eterno-fc-careers-v1";
const ACTIVE_KEY = "eterno-fc-active-career-v2";
const LEGACY_ACTIVE_KEY = "eterno-fc-active-career-v1";

const NAV_ITEMS = [
  ["Visão geral", "01"],
  ["Elenco", "02"],
  ["Táticas", "03"],
  ["Calendário", "04"],
  ["Competições", "05"],
  ["Mercado", "06"],
  ["Categorias de base", "07"],
  ["Finanças", "08"],
  ["Carreira", "09"],
] as const;

const POSITION_ORDER = ["GOL", "LD", "LE", "ZAG", "VOL", "MC", "MEI", "PE", "PD", "ATA"];

function Crest({ club, small = false }: { club: Club; small?: boolean }) {
  return (
    <span
      className={`crest ${small ? "crest-small" : ""} ${club.badge ? "has-badge" : ""}`}
      style={{ "--club-primary": club.primary, "--club-secondary": club.secondary, ...(club.badge ? { backgroundImage: `url(${club.badge})` } : {}) } as CSSProperties}
      aria-label={`Escudo do ${club.name}`}
    >
      {club.badge ? "" : club.short}
    </span>
  );
}

function Rating({ value }: { value: number }) {
  const tone = value >= 82 ? "elite" : value >= 74 ? "good" : value >= 65 ? "average" : "prospect";
  return <span className={`rating rating-${tone}`}>{value}</span>;
}

function LoadingGame() {
  return (
    <main className="loading-game">
      <span className="brand-mark">E</span>
      <strong>ETERNO FC</strong>
      <small>Preparando o vestiário…</small>
    </main>
  );
}

function SectionIntro({ eyebrow, title, children, action }: { eyebrow: string; title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="section-intro">
      <div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{children}</p></div>
      {action}
    </section>
  );
}

function Dashboard({ game, onPlay, onSection, onNextSeason }: { game: GameState; onPlay: () => void; onSection: (section: string) => void; onNextSeason: () => void }) {
  const club = userClub(game);
  const next = nextUserFixture(game);
  const nextCompetition = next ? competitionById(game, next.competitionId) : undefined;
  const table = game.standings;
  const rank = Math.max(1, table.findIndex((row) => row.clubId === game.userClubId) + 1);
  const last = game.lastFive;
  const wins = last.filter((result) => result === "V").length;
  const draws = last.filter((result) => result === "E").length;
  const losses = last.filter((result) => result === "D").length;
  const scorers = squadFor(game, game.userClubId).sort((a, b) => b.goals - a.goals || b.rating - a.rating);
  const recentFixtures = game.fixtures.filter((fixture) => fixture.played && (fixture.homeId === game.userClubId || fixture.awayId === game.userClubId)).slice(-5);
  const goalsFor = recentFixtures.reduce((sum, fixture) => sum + (fixture.homeId === game.userClubId ? fixture.homeGoals ?? 0 : fixture.awayGoals ?? 0), 0);
  const goalsAgainst = recentFixtures.reduce((sum, fixture) => sum + (fixture.homeId === game.userClubId ? fixture.awayGoals ?? 0 : fixture.homeGoals ?? 0), 0);
  const upcoming = game.fixtures.filter((fixture) => !fixture.played && (fixture.homeId === game.userClubId || fixture.awayId === game.userClubId)).sort((a,b)=>a.date.localeCompare(b.date)).slice(0, 3);
  const seasonOver = seasonIsOver(game);

  return (
    <>
      <section className="welcome-row">
        <div>
          <p className="eyebrow">CENTRAL DO TREINADOR</p>
          <h1>{game.managerStatus === "unemployed" ? "O telefone pode tocar a qualquer momento." : seasonOver ? "A temporada terminou." : `Boa noite, ${game.managerName.split(" ")[0]}.`}</h1>
          <p>{game.managerStatus === "unemployed" ? "Você está sem clube. Analise as vagas e propostas sem perder a história da sua carreira." : seasonOver ? `A temporada ${game.season} já tem sua história escrita. É hora de preparar o próximo ano.` : `${last.length ? `Seu time vem de ${last.slice(-3).join(" • ")}.` : `Você começa na ${userLeague(game).short}.`} Há ${upcoming.length} compromissos visíveis na agenda imediata.`}</p>
        </div>
        <div className="club-status">
          <div><small>CONFIANÇA DA DIRETORIA</small><strong>{game.boardConfidence}%</strong></div>
          <span className="confidence-track"><i style={{ width: `${game.boardConfidence}%` }} /></span>
          <b>{game.boardConfidence >= 80 ? "Excelente" : game.boardConfidence >= 60 ? "Estável" : "Sob pressão"}</b>
        </div>
      </section>

      {game.managerStatus === "unemployed" ? (
        <article className="season-finale panel unemployed-card"><div><span>CARREIRA DO TREINADOR</span><h2>Mercado de trabalho</h2><p>Ser demitido não encerra o save. Clubes de qualquer divisão ou país podem abrir vagas e apresentar propostas conforme sua reputação.</p></div><button className="primary-button" onClick={()=>onSection("Carreira")}>VER VAGAS E PROPOSTAS ›</button></article>
      ) : seasonOver ? (
        <article className="season-finale panel">
          <div><span>TEMPORADA {game.season}</span><h2>{table[0]?.clubId === game.userClubId ? "Campeões!" : `${rank}º lugar`}</h2><p>Você terminou com {table.find((row) => row.clubId === game.userClubId)?.points ?? 0} pontos. Jogadores envelhecerão, contratos avançarão e uma nova geração chegará à base.</p></div>
          <button className="primary-button" onClick={onNextSeason}>INICIAR TEMPORADA {game.season + 1} <span>›</span></button>
        </article>
      ) : next ? (
        <section className="hero-grid">
          <article className="next-match panel">
            <div className="panel-title"><span>PRÓXIMA PARTIDA</span><small>{nextCompetition?.short.toUpperCase()} • {next.stage.toUpperCase()} {next.round}</small></div>
            <div className="match-stage">
              <div className="team"><Crest club={clubById(game, next.homeId)} /><strong>{clubById(game, next.homeId).name}</strong><small>{table.findIndex((row) => row.clubId === next.homeId) + 1 || "—"}º • {table.find((row) => row.clubId === next.homeId)?.points ?? 0} pts</small></div>
              <div className="kickoff"><span>{next.date === game.date ? "HOJE" : formatGameDate(next.date).toUpperCase()}</span><strong>20:30</strong><small>{clubById(game, next.homeId).stadium}</small></div>
              <div className="team"><Crest club={clubById(game, next.awayId)} /><strong>{clubById(game, next.awayId).name}</strong><small>{table.findIndex((row) => row.clubId === next.awayId) + 1 || "—"}º • {table.find((row) => row.clubId === next.awayId)?.points ?? 0} pts</small></div>
            </div>
            <div className="match-actions">
              <div><small>FORMAÇÃO</small><strong>{game.formation} • {game.mentality}</strong></div>
              <div><small>ESTÁDIO</small><strong>{clubById(game, next.homeId).stadium}</strong></div>
              <button onClick={onPlay}>PREPARAR PARTIDA <span>›</span></button>
            </div>
          </article>

          <article className="form-panel panel">
            <div className="panel-title"><span>MOMENTO</span><small>{last.length ? `ÚLTIMAS ${last.length}` : "ESTREIA"}</small></div>
            <div className="form-score"><strong>{wins}V</strong><span>{draws}E</span><small>{losses}D</small></div>
            <div className="form-strip">{(last.length ? last : ["—", "—", "—", "—", "—"]).map((result, index) => <i className={`result-${result}`} key={`${result}-${index}`}>{result}</i>)}</div>
            <div className="form-stats">
              <div><small>GOLS</small><strong>{goalsFor}</strong></div><div><small>SOFRIDOS</small><strong>{goalsAgainst}</strong></div><div><small>ARTILHEIRO</small><strong>{scorers[0]?.goals ?? 0}</strong></div>
            </div>
            <p><span>↗</span> {scorers[0]?.name ?? "Elenco pronto para estrear"}</p>
          </article>
        </section>
      ) : null}

      <section className="dashboard-grid">
        <article className="table-panel panel">
          <div className="panel-title"><span>{userLeague(game).name.toUpperCase()}</span><button onClick={() => onSection("Competições")}>VER COMPLETA ›</button></div>
          <div className="standings-head"><span>#</span><span>CLUBE</span><span>J</span><span>V</span><span>E</span><span>D</span><span>SG</span><b>PTS</b></div>
          {table.slice(0, 5).map((row, index) => {
            const rowClub = clubById(game, row.clubId);
            return <div className={`standings-row ${row.clubId === game.userClubId ? "is-us" : ""}`} key={row.clubId}><span>{index + 1}</span><span><Crest club={rowClub} small />{rowClub.name}</span><span>{row.played}</span><span>{row.wins}</span><span>{row.draws}</span><span>{row.losses}</span><span>{row.gd}</span><b>{row.points}</b></div>;
          })}
        </article>

        <article className="fixtures-panel panel">
          <div className="panel-title"><span>AGENDA</span><button onClick={() => onSection("Calendário")}>CALENDÁRIO ›</button></div>
          {upcoming.length ? upcoming.map((fixture, index) => {
            const opponentId = fixture.homeId === game.userClubId ? fixture.awayId : fixture.homeId;
            return <div className={`fixture ${index === 0 ? "fixture-today" : ""}`} key={fixture.id}><span>{index === 0 ? competitionById(game,fixture.competitionId).short.toUpperCase() : formatGameDate(fixture.date).toUpperCase()}</span><div><strong>{fixture.homeId === game.userClubId ? club.name : clubById(game, opponentId).name}</strong><small>{fixture.awayId === game.userClubId ? club.name : clubById(game, opponentId).name}</small></div><b>{fixture.stage === "Liga" ? `R${fixture.round}` : fixture.stage.slice(0,6)}</b></div>;
          }) : <div className="empty-row">Calendário encerrado.</div>}
          <div className="training"><span>AMANHÃ</span><strong>Recuperação & análise</strong><small>10:00</small></div>
        </article>

        <article className="story-panel panel">
          <div className="story-photo"><span>{game.news[0]?.category.toUpperCase() ?? "DESTAQUE"}</span><div className="player-silhouette"><i /><b>{scorers[0]?.position === "ATA" ? 9 : 10}</b></div></div>
          <div className="story-copy"><small>NOTÍCIAS DO CLUBE • {formatGameDate(game.news[0]?.date ?? game.date).toUpperCase()}</small><h2>{game.news[0]?.title}</h2><p>{game.news[0]?.body}</p><button onClick={() => onSection("Notícias")}>VER CENTRAL ›</button></div>
        </article>
      </section>
    </>
  );
}

function SquadView({ game, update }: { game: GameState; update: (next: GameState) => void }) {
  const [position, setPosition] = useState("Todos");
  const [query, setQuery] = useState("");
  const squad = squadFor(game, game.userClubId).filter((player) => (position === "Todos" || player.position === position) && player.name.toLowerCase().includes(query.toLowerCase())).sort((a, b) => Number(b.starting) - Number(a.starting) || POSITION_ORDER.indexOf(a.position) - POSITION_ORDER.indexOf(b.position) || b.rating - a.rating);
  const starters = squadFor(game, game.userClubId).filter((player) => player.starting).length;
  const average = Math.round(squadFor(game, game.userClubId).reduce((sum, player) => sum + player.rating, 0) / squadFor(game, game.userClubId).length);
  return (
    <>
      <SectionIntro eyebrow="GESTÃO ESPORTIVA" title="Elenco principal">{starters} titulares definidos • força média {average} • folha mensal {formatMoney(squadFor(game, game.userClubId).reduce((sum, player) => sum + player.wage, 0) * 4)}</SectionIntro>
      <div className="toolbar panel"><label>BUSCAR<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nome do jogador" /></label><label>POSIÇÃO<select value={position} onChange={(event) => setPosition(event.target.value)}><option>Todos</option>{POSITION_ORDER.map((item) => <option key={item}>{item}</option>)}</select></label><div className="toolbar-note"><span className="starter-dot" /> Clique em “Titular” para montar o onze inicial</div></div>
      <article className="data-panel panel">
        <div className="player-head"><span>JOGADOR</span><span>POS</span><span>IDADE</span><span>GER</span><span>FÍSICO</span><span>MORAL</span><span>VALOR</span><span>CONTRATO</span><span>AÇÃO</span></div>
        {squad.map((player) => <PlayerRow key={player.id} player={player} action={<div className="row-actions"><button className={player.starting ? "selected" : ""} onClick={() => update(toggleStarter(game, player.id))}>{player.starting ? "Titular" : "Reserva"}</button><button className="subtle-danger" onClick={() => update(sellPlayer(game, player.id))}>Vender</button></div>} />)}
      </article>
    </>
  );
}

function PlayerRow({ player, action, club }: { player: Player; action: React.ReactNode; club?: Club }) {
  return <div className="player-row"><span><span className="player-avatar">{player.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><span><strong>{player.name}</strong><small>{club ? `${club.name} • ${player.temperament}` : `${player.goals} gols • ${player.temperament}`}</small></span></span><span className="position-tag">{player.position}</span><span>{player.age}</span><span><Rating value={player.rating} /></span><span><Meter value={player.fitness} /></span><span><Meter value={player.morale} mood /></span><span>{formatMoney(player.value)}</span><span>{player.contract} ano{player.contract === 1 ? "" : "s"}</span><span>{action}</span></div>;
}

function Meter({ value, mood = false }: { value: number; mood?: boolean }) {
  return <span className={`mini-meter ${mood ? "mood" : ""}`}><i style={{ width: `${value}%` }} /><b>{value}</b></span>;
}

function TacticsView({ game, update }: { game: GameState; update: (next: GameState) => void }) {
  const starters = squadFor(game, game.userClubId).filter((player) => player.starting).sort((a, b) => POSITION_ORDER.indexOf(a.position) - POSITION_ORDER.indexOf(b.position)).slice(0, 11);
  const positions = [[50,88],[18,70],[40,73],[61,73],[82,70],[25,48],[50,52],[76,48],[18,24],[50,18],[82,24]];
  return (
    <>
      <SectionIntro eyebrow="PRANCHETA" title="Identidade tática">Sua estratégia altera a força ofensiva, o desgaste e a maneira como o motor simula cada partida.</SectionIntro>
      <section className="tactics-layout">
        <article className="tactic-controls panel">
          <div className="panel-title"><span>PLANO DE JOGO</span><small>SALVO AUTOMATICAMENTE</small></div>
          <label>FORMAÇÃO<select value={game.formation} onChange={(event) => update({ ...game, formation: event.target.value as GameState["formation"] })}><option>4-3-3</option><option>4-4-2</option><option>4-2-3-1</option><option>3-5-2</option></select></label>
          <fieldset><legend>MENTALIDADE</legend><div className="segmented">{(["Defensiva","Equilibrada","Ofensiva"] as const).map((value) => <button className={game.mentality === value ? "active" : ""} onClick={() => update({ ...game, mentality: value })} key={value}>{value}</button>)}</div></fieldset>
          <fieldset><legend>INTENSIDADE</legend><div className="segmented">{(["Baixa","Normal","Alta"] as const).map((value) => <button className={game.intensity === value ? "active" : ""} onClick={() => update({ ...game, intensity: value })} key={value}>{value}</button>)}</div></fieldset>
          <div className="tactic-impact"><strong>Leitura do auxiliar</strong><p>{game.mentality === "Ofensiva" ? "O time criará mais chances, mas deixará espaço nas costas." : game.mentality === "Defensiva" ? "Linhas compactas reduzem riscos e o volume ofensivo." : "Equilíbrio entre criação, proteção e controle territorial."} {game.intensity === "Alta" ? "A pressão alta aumenta o desgaste." : game.intensity === "Baixa" ? "A baixa intensidade preserva o físico." : "O ritmo é sustentável para noventa minutos."}</p></div>
        </article>
        <article className="tactics-pitch panel">
          <div className="pitch-lines"><i /><b /></div>
          {starters.map((player, index) => <button className="tactic-player" style={{ left: `${positions[index]?.[0] ?? 50}%`, top: `${positions[index]?.[1] ?? 50}%` }} key={player.id} title={`${player.name} • ${player.rating}`}><span>{player.rating}</span><small>{player.name.split(" ").at(-1)}</small></button>)}
        </article>
      </section>
    </>
  );
}

function CalendarView({ game, onPlay }: { game: GameState; onPlay: () => void }) {
  const fixtures = game.fixtures.filter((fixture) => fixture.homeId === game.userClubId || fixture.awayId === game.userClubId).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
  const next = nextUserFixture(game);
  return (
    <>
      <SectionIntro eyebrow={`TEMPORADA ${game.season}`} title="Calendário completo">Estaduais, liga nacional, copa do país e competições continentais convivem no mesmo ano. Avance partida por partida, sem temporadas instantâneas.</SectionIntro>
      <article className="calendar-list panel">
        {fixtures.map((fixture) => {
          const home = clubById(game, fixture.homeId); const away = clubById(game, fixture.awayId);
          const competition=competitionById(game,fixture.competitionId);
          return <div className={`calendar-row ${fixture.id === next?.id ? "next" : ""}`} key={fixture.id}><span><small>{competition.short}</small><strong>{fixture.stage === "Liga" ? `R${String(fixture.round).padStart(2,"0")}` : fixture.stage.slice(0,8)}</strong></span><time>{formatGameDate(fixture.date, true)}</time><div className="calendar-teams"><span>{home.name}<Crest club={home} small /></span><b>{fixture.played ? `${fixture.homeGoals}  —  ${fixture.awayGoals}` : "20:30"}</b><span><Crest club={away} small />{away.name}</span></div><span className={`fixture-state ${fixture.played ? "played" : ""}`}>{fixture.played ? "ENCERRADO" : fixture.id === next?.id ? "PRÓXIMO" : "AGENDADO"}</span>{fixture.id === next?.id && <button onClick={onPlay}>JOGAR ›</button>}</div>;
        })}
      </article>
    </>
  );
}

function CompetitionView({ game }: { game: GameState }) {
  const [selected,setSelected]=useState(userClub(game).divisionId);
  const competition=competitionById(game,selected)??game.competitions[0];
  const table=(competition.type==="league"||competition.type==="state")?competitionTable(game,competition.id):[];
  const competitionFixtures=game.fixtures.filter((fixture)=>fixture.competitionId===competition.id).sort((a,b)=>a.date.localeCompare(b.date)||a.round-b.round);
  const league=game.leagues.find((item)=>item.id===competition.divisionId);
  return (
    <>
      <SectionIntro eyebrow={`${competition.country} • ${competition.type==="league"?"LIGA":competition.type==="state"?"ESTADUAL":"MATA-MATA"}`} title={competition.name}>Todas as ligas são simuladas simultaneamente. Nas divisões, as faixas verdes indicam acesso e as vermelhas, descenso.</SectionIntro>
      <div className="competition-picker panel"><label>COMPETIÇÃO<select value={selected} onChange={(event)=>setSelected(event.target.value)}>{game.competitions.map((item)=><option value={item.id} key={item.id}>{item.country} • {item.name}</option>)}</select></label><div><span>{competition.participantIds.length} clubes</span><strong>{competition.complete?`Campeão: ${clubById(game,competition.championId!).name}`:`Fase atual: ${competition.currentStage}`}</strong></div></div>
      {(competition.type==="league"||competition.type==="state") ? <article className="full-standings panel">
        <div className="full-standing header"><span>POS</span><span>CLUBE</span><span>J</span><span>V</span><span>E</span><span>D</span><span>GP</span><span>GC</span><span>SG</span><b>PTS</b><span>DESTINO</span></div>
        {table.map((row,index)=>{const club=clubById(game,row.clubId);const promoted=!!league&&index<league.promotionPlaces;const relegated=!!league&&league.relegationPlaces>0&&index>=table.length-league.relegationPlaces;return <div className={`full-standing ${row.clubId===game.userClubId?"is-us":""}`} key={row.clubId}><span><i className={promoted?"promotion-zone":relegated?"danger-zone":index<4?"continental":""}/>{index+1}</span><span><Crest club={club} small/><strong>{club.name}</strong><small>{club.city}</small></span><span>{row.played}</span><span>{row.wins}</span><span>{row.draws}</span><span>{row.losses}</span><span>{row.gf}</span><span>{row.ga}</span><span>{row.gd}</span><b>{row.points}</b><span className={`destination ${promoted?"up":relegated?"down":""}`}>{promoted?"↑ ACESSO":relegated?"↓ DESCENSO":competition.type==="state"&&index===0?"TÍTULO":"—"}</span></div>;})}
      </article> : <section className="cup-bracket panel"><div className="cup-stage-head"><span>FASES E RESULTADOS</span><strong>{competition.complete?"ENCERRADA":competition.currentStage.toUpperCase()}</strong></div>{competitionFixtures.map((fixture)=>{const home=clubById(game,fixture.homeId),away=clubById(game,fixture.awayId);return <div className={`cup-fixture ${fixture.homeId===game.userClubId||fixture.awayId===game.userClubId?"is-us":""}`} key={fixture.id}><span>{fixture.stage}<small>{formatGameDate(fixture.date)}</small></span><div><strong>{home.name}</strong><Crest club={home} small/></div><b>{fixture.played?`${fixture.homeGoals} — ${fixture.awayGoals}`:"x"}</b><div><Crest club={away} small/><strong>{away.name}</strong></div></div>;})}</section>}
      {!!game.history.length&&<article className="history-panel panel"><div className="panel-title"><span>HISTÓRIA DA CARREIRA</span><small>{game.history.length} TEMPORADA(S)</small></div>{game.history.map((record)=><div key={`${record.season}-${record.club}`}><strong>{record.season}</strong><span>{record.club} • {record.division}</span><span>{record.outcome} • {record.userPoints} pts</span></div>)}</article>}
    </>
  );
}

function MarketView({ game, update }: { game: GameState; update: (next: GameState) => void }) {
  const [query,setQuery]=useState("");const [position,setPosition]=useState("Todos");const [mode,setMode]=useState<"ofertas"|"busca"|"transações">("ofertas");
  const players=game.players.filter((player)=>!player.academy&&player.clubId!==game.userClubId&&(position==="Todos"||player.position===position)&&player.name.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>Number(b.listed)-Number(a.listed)||b.rating-a.rating||a.value-b.value).slice(0,40);
  const offered=game.marketOffers.map((offer)=>({offer,player:game.players.find((item)=>item.id===offer.playerId)})).filter((item):item is {offer:typeof game.marketOffers[number];player:Player}=>!!item.player);
  const window=transferWindow(game);
  return (
    <>
      <SectionIntro eyebrow="JANELA DE TRANSFERÊNCIAS" title="Mercado"><span className="inline-budget">{window.open?`ABERTA • ${window.label}`:"FECHADA"} · orçamento: <strong>{formatMoney(game.transferBudget)}</strong></span></SectionIntro>
      <div className="market-tabs"><button className={mode==="ofertas"?"active":""} onClick={()=>setMode("ofertas")}>OFERTADOS <span>{offered.length}</span></button><button className={mode==="busca"?"active":""} onClick={()=>setMode("busca")}>PESQUISA GLOBAL</button><button className={mode==="transações"?"active":""} onClick={()=>setMode("transações")}>TRANSAÇÕES <span>{game.transferEvents.length}</span></button></div>
      {mode==="ofertas"&&<><section className="offer-grid">{offered.map(({offer,player})=><article className="transfer-offer panel" key={offer.id}><div><Crest club={clubById(game,offer.fromClubId)}/><span><small>OFERECIDO POR {clubById(game,offer.fromClubId).name.toUpperCase()}</small><h3>{player.name}</h3><p>{player.position} • {player.age} anos • geral {player.rating}</p></span></div><div><span><small>PREÇO PEDIDO</small><strong>{formatMoney(offer.askingPrice)}</strong></span><button disabled={!window.open||offer.askingPrice>game.transferBudget||offer.askingPrice>game.balance} onClick={()=>update(buyPlayer(game,player.id,offer.askingPrice))}>{window.open?"NEGOCIAR ›":"MERCADO FECHADO"}</button></div></article>)}</section>{game.incomingBids.length>0&&<article className="incoming-panel panel"><div className="panel-title"><span>PROPOSTAS PELOS SEUS JOGADORES</span><small>{game.incomingBids.length} PENDENTE(S)</small></div>{game.incomingBids.map((bid)=>{const player=game.players.find((item)=>item.id===bid.playerId);if(!player)return null;return <div className="incoming-row" key={bid.id}><span><strong>{player.name}</strong><small>{clubById(game,bid.fromClubId).name} oferece {formatMoney(bid.fee)}</small></span><div><button onClick={()=>update(rejectBid(game,bid.id))}>RECUSAR</button><button className="accept" disabled={!window.open} onClick={()=>update(acceptBid(game,bid.id))}>{window.open?"ACEITAR":"MERCADO FECHADO"}</button></div></div>;})}</article>}</>}
      {mode==="busca"&&<><div className="toolbar panel"><label>BUSCAR<input value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Jogador ou sobrenome" /></label><label>POSIÇÃO<select value={position} onChange={(event)=>setPosition(event.target.value)}><option>Todos</option>{POSITION_ORDER.map((item)=><option key={item}>{item}</option>)}</select></label><div className="toolbar-note">108 clubes e quatro países pesquisáveis.</div></div><article className="data-panel market-table panel"><div className="player-head"><span>JOGADOR</span><span>POS</span><span>IDADE</span><span>GER</span><span>FÍSICO</span><span>MORAL</span><span>VALOR</span><span>CONTRATO</span><span>AÇÃO</span></div>{players.map((player)=><PlayerRow key={player.id} player={player} club={clubById(game,player.clubId)} action={<button className="buy-button" disabled={!window.open||player.value>game.transferBudget||player.value>game.balance} onClick={()=>update(buyPlayer(game,player.id))}>{!window.open?"Mercado fechado":player.value>game.transferBudget?"Sem verba":"Negociar"}</button>}/>)}</article></>}
      {mode==="transações"&&<article className="transaction-feed panel"><div className="panel-title"><span>MERCADO MUNDIAL AO VIVO</span><small>ÚLTIMAS {game.transferEvents.length}</small></div>{game.transferEvents.length?game.transferEvents.map((event)=><div className="transaction-row" key={event.id}><time>{formatGameDate(event.date)}</time><strong>{event.playerName}</strong><span>{clubById(game,event.fromClubId).short} <b>→</b> {clubById(game,event.toClubId).short}</span><em>{formatMoney(event.fee)}</em></div>):<div className="empty-row">As primeiras transações aparecerão durante as rodadas.</div>}</article>}
    </>
  );
}

function AcademyView({ game, update }: { game: GameState; update: (next: GameState) => void }) {
  const prospects = game.players.filter((player)=>player.clubId===game.userClubId&&player.academy).sort((a,b)=>b.potential-a.potential);
  const upgradeCost = game.academyLevel * 3_000_000;
  return (
    <>
      <SectionIntro eyebrow="FUTURO DO CLUBE" title="Categorias de base" action={<div className="academy-level"><small>ESTRUTURA</small><strong>NÍVEL {game.academyLevel}/5</strong><span>{Array.from({length:5},(_,index)=><i className={index<game.academyLevel?"on":""} key={index} />)}</span></div>}>Jovens evoluem a cada virada de temporada. Potencial é uma projeção, não uma promessa.</SectionIntro>
      <div className="academy-actions"><button className="primary-button" onClick={()=>update(scoutProspect(game))} disabled={game.balance<600_000}>ENVIAR OLHEIRO <span>{formatMoney(600_000)}</span></button><button className="secondary-button" onClick={()=>update(upgradeAcademy(game))} disabled={game.academyLevel>=5||game.balance<upgradeCost}>MELHORAR ESTRUTURA <span>{game.academyLevel>=5?"MÁXIMO":formatMoney(upgradeCost)}</span></button></div>
      <section className="prospect-grid">{prospects.map((player)=><article className="prospect-card panel" key={player.id}><div className="prospect-top"><span className="player-avatar large">{player.name.split(" ").map((part)=>part[0]).slice(0,2).join("")}</span><Rating value={player.rating}/></div><span className="position-tag">{player.position}</span><h3>{player.name}</h3><p>{player.age} anos • Brasil</p><div><small>POTENCIAL ESTIMADO</small><strong>{player.potential}</strong><span className="potential-track"><i style={{width:`${player.potential}%`}} /></span></div><button onClick={()=>update(promoteYouth(game,player.id))}>PROMOVER AO PROFISSIONAL ›</button></article>)}</section>
    </>
  );
}

function FinanceView({ game }: { game: GameState }) {
  const wages = squadFor(game,game.userClubId).reduce((sum,player)=>sum+player.wage,0)*4;
  const projection = (game.weeklyIncome-game.weeklyExpenses)*4;
  return (
    <>
      <SectionIntro eyebrow="ADMINISTRAÇÃO" title="Finanças do clube">Um clube saudável consegue atravessar temporadas ruins sem destruir o projeto esportivo.</SectionIntro>
      <section className="finance-cards"><article className="finance-card dark"><small>SALDO EM CAIXA</small><strong>{formatMoney(game.balance)}</strong><span className={projection>=0?"positive":"negative"}>{projection>=0?"↗":"↘"} {formatMoney(Math.abs(projection))}/mês projetado</span></article><article className="finance-card"><small>ORÇAMENTO DE TRANSFERÊNCIAS</small><strong>{formatMoney(game.transferBudget)}</strong><p>Verba reservada para contratações.</p></article><article className="finance-card"><small>FOLHA DO ELENCO</small><strong>{formatMoney(wages)}</strong><p>Compromisso mensal atual.</p></article></section>
      <section className="finance-layout"><article className="cashflow panel"><div className="panel-title"><span>FLUXO SEMANAL</span><small>RECORRENTE</small></div><div><span>Patrocínios, TV e sócios</span><strong className="positive">+ {formatMoney(game.weeklyIncome)}</strong></div><div><span>Salários e operação</span><strong className="negative">− {formatMoney(game.weeklyExpenses)}</strong></div><div className="cash-total"><span>Resultado da semana</span><strong className={game.weeklyIncome>=game.weeklyExpenses?"positive":"negative"}>{formatMoney(game.weeklyIncome-game.weeklyExpenses)}</strong></div></article><article className="objectives panel"><div className="panel-title"><span>EXPECTATIVAS DA DIRETORIA</span><small>{game.boardConfidence}% CONFIANÇA</small></div>{game.boardObjectives.map((objective)=><div key={objective.id+objective.label}><span><i className={objective.status==="cumprida"?"done":""} />{objective.label}</span><b>{objective.weight}% • {objective.status}</b></div>)}</article></section>
    </>
  );
}

function CareerView({game,update}:{game:GameState;update:(next:GameState)=>void}) {
  const current=userClub(game);
  return <>
    <SectionIntro eyebrow="CARREIRA DO TREINADOR" title={game.managerName} action={<div className="manager-reputation"><small>REPUTAÇÃO</small><strong>{Math.round(game.managerReputation)}</strong><span>{game.managerPoints} pontos</span></div>}>Você não controla um clube para sempre: constrói uma carreira. Resultados trazem convites; crises trazem demissão.</SectionIntro>
    <section className="career-summary"><article className="career-current panel"><div><Crest club={current}/><span><small>{game.managerStatus==="employed"?"CLUBE ATUAL":"ÚLTIMO CLUBE"}</small><h2>{current.name}</h2><p>{userLeague(game).name} • confiança {game.boardConfidence}%</p><p>Contrato até {game.managerContract.expiresSeason} • {formatMoney(game.managerContract.weeklySalary)}/semana</p></span></div>{game.managerStatus==="employed"?<div className="career-actions"><button className="resign-button" onClick={()=>update(toggleJobOffers(game))}>{game.acceptingJobOffers?"PROPOSTAS: ABERTAS":"PROPOSTAS: FECHADAS"}</button><button className="resign-button" onClick={()=>update(resignJob(game))}>PEDIR DEMISSÃO</button></div>:<strong className="unemployed-label">SEM CLUBE</strong>}</article><article className="career-numbers panel"><div><small>JOGOS</small><strong>{game.matchesManaged}</strong></div><div><small>PONTOS DE CARREIRA</small><strong>{game.managerPoints}</strong></div><div><small>CLUBES</small><strong>{game.managerRecord.length}</strong></div><div><small>TEMPORADAS</small><strong>{game.history.length+1}</strong></div></article></section>
    {game.jobOffers.length>0&&<section className="job-section"><div className="job-title"><span>PROPOSTAS DIRETAS</span><small>Clubes que procuraram você</small></div><div className="job-grid">{game.jobOffers.map((offer)=>{const club=clubById(game,offer.clubId);return <article className="job-card offered panel" key={offer.id}><Crest club={club}/><div><small>CONVITE FORMAL</small><h3>{club.name}</h3><p>{game.leagues.find((league)=>league.id===club.divisionId)?.name} • reputação {club.reputation}</p><p>{formatMoney(offer.weeklySalary)}/semana • {offer.contractYears} ano(s){offer.releaseClausePaid?` • multa quitada: ${formatMoney(offer.releaseClausePaid)}`:""}</p></div><button onClick={()=>update(acceptJob(game,offer.id))}>ACEITAR CARGO ›</button></article>;})}</div></section>}
    <section className="job-section"><div className="job-title"><span>VAGAS ABERTAS</span><small>{game.vacancies.filter((vacancy)=>vacancy.status==="open"&&!(game.managerStatus==="unemployed"&&vacancy.clubId===game.userClubId)).length} clubes procurando treinador</small></div><div className="job-grid">{game.vacancies.filter((vacancy)=>vacancy.status==="open"&&!(game.managerStatus==="unemployed"&&vacancy.clubId===game.userClubId)).map((vacancy)=>{const club=clubById(game,vacancy.clubId),eligible=game.managerReputation+8>=vacancy.minimumReputation;return <article className="job-card panel" key={vacancy.id}><Crest club={club}/><div><small>{club.country.toUpperCase()}</small><h3>{club.name}</h3><p>{game.leagues.find((league)=>league.id===club.divisionId)?.name} • exige {vacancy.minimumReputation}</p></div><button disabled={!eligible} onClick={()=>update(applyForJob(game,vacancy.id))}>{eligible?"CANDIDATAR-SE ›":"REPUTAÇÃO BAIXA"}</button></article>;})}</div></section>
    <article className="manager-history panel"><div className="panel-title"><span>TRAJETÓRIA</span><small>REGISTRO PERMANENTE</small></div>{game.managerRecord.map((record,index)=>{const club=clubById(game,record.clubId);return <div key={`${record.clubId}-${index}`}><Crest club={club} small/><strong>{club.name}</strong><span>{record.fromSeason} — {record.toSeason??"atual"}</span><span>{record.matches} jogos • {record.wins} vitórias</span></div>;})}</article>
  </>;
}

function NewsView({ game }: { game: GameState }) {
  return <><SectionIntro eyebrow="MUNDO DO FUTEBOL" title="Central de notícias">Resultados, decisões de mercado, categorias de base e os capítulos da sua carreira.</SectionIntro><section className="news-feed">{game.news.map((item)=><article className={`news-item panel ${item.unread?"unread":""}`} key={item.id}><span>{item.category}</span><div><small>{formatGameDate(item.date,true)}</small><h2>{item.title}</h2><p>{item.body}</p></div></article>)}</section></>;
}

function MatchCenter({ game, plan, minute, running, onToggle, onSkip, onFinish, onClose }: { game: GameState; plan: MatchPlan; minute: number; running: boolean; onToggle:()=>void; onSkip:()=>void; onFinish:()=>void; onClose:()=>void }) {
  const fixture=game.fixtures.find((item)=>item.id===plan.fixtureId)!; const home=clubById(game,fixture.homeId); const away=clubById(game,fixture.awayId);
  const visibleEvents=plan.events.filter((event)=>event.minute<=minute); const homeGoals=visibleEvents.filter((event)=>event.type==="goal"&&event.teamId===home.id).length; const awayGoals=visibleEvents.filter((event)=>event.type==="goal"&&event.teamId===away.id).length;
  const homePlayers=squadFor(game,home.id).filter((player)=>player.starting).slice(0,11); const awayPlayers=squadFor(game,away.id).filter((player)=>player.starting).slice(0,11);
  const phase=plan.phases.find((item)=>minute>=item.start&&minute<=item.end)??plan.phases.at(-1)!;const possessionClub=phase.teamId===home.id?home:away;const possessionPlayers=phase.teamId===home.id?homePlayers:awayPlayers;
  const base:[[number,number],[number,number],[number,number],[number,number],[number,number],[number,number],[number,number],[number,number],[number,number],[number,number],[number,number]]=[[7,50],[23,15],[20,38],[20,62],[23,85],[42,25],[40,50],[42,75],[65,18],[70,50],[65,82]];
  const coordinates=(index:number,side:"home"|"away")=>{const [rawX,rawY]=base[index]??[50,50];const ownPossession=phase.teamId===(side==="home"?home.id:away.id);const advance=phase.zone==="ataque"?14:phase.zone==="meio"?7:0;let x=side==="home"?rawX:100-rawX;if(ownPossession)x+=side==="home"?advance:-advance;else x+=side==="home"?-Math.min(8,advance):Math.min(8,advance);const y=rawY+Math.sin((minute+index*11)*.11)*1.1;return{x:Math.max(4,Math.min(96,x)),y:Math.max(5,Math.min(95,y))};};
  const playerStyle=(index:number,side:"home"|"away")=>{const point=coordinates(index,side);return{left:`${point.x}%`,top:`${point.y}%`} as CSSProperties;};const carrierIndex=1+(phase.carrier%10),carrierSide=phase.teamId===home.id?"home":"away",ballPoint=coordinates(carrierIndex,carrierSide);const carrier=possessionPlayers[carrierIndex];
  return <div className="match-overlay" role="dialog" aria-modal="true" aria-label="Central da partida"><header><div><span>{competitionById(game,fixture.competitionId).name.toUpperCase()} • {fixture.stage.toUpperCase()}</span><small>{formatGameDate(fixture.date,true)} • {home.stadium}</small></div><button onClick={onClose} disabled={minute>0&&minute<90} aria-label="Fechar partida">×</button></header><section className="live-score"><div><Crest club={home}/><strong>{home.name}</strong></div><span><small>{minute>=90?"ENCERRADO":running?`${minute}' • AO VIVO`:minute===0?"PRÉ-JOGO":`${minute}' • PAUSADO`}</small><b>{homeGoals} <i>—</i> {awayGoals}</b></span><div><Crest club={away}/><strong>{away.name}</strong></div></section><section className="possession-readout" style={{"--possession-color":possessionClub.primary} as CSSProperties}><Crest club={possessionClub} small/><span><small>{phase.zone==="ataque"?"ATAQUE PERIGOSO":phase.zone==="meio"?"CONSTRUÇÃO NO MEIO":"SAÍDA DE BOLA"}</small><strong>{possessionClub.name} com a posse{carrier?` • ${carrier.name}`:""}</strong></span><b>{phase.teamId===home.id?"ATACA →":"← ATACA"}</b></section><section className="match-body"><div className="mini-pitch"><div className="pitch-markings"><i/><b/><em/></div>{homePlayers.map((player,index)=><span className={`pitch-player home ${phase.teamId===home.id&&index===carrierIndex?"carrier":""}`} style={playerStyle(index,"home")} key={player.id}><i style={{background:home.primary,borderColor:home.secondary}}/><small>{player.name.split(" ").at(-1)}</small></span>)}{awayPlayers.map((player,index)=><span className={`pitch-player away ${phase.teamId===away.id&&index===carrierIndex?"carrier":""}`} style={playerStyle(index,"away")} key={player.id}><i style={{background:away.primary,borderColor:away.secondary}}/><small>{player.name.split(" ").at(-1)}</small></span>)}<span className="ball" style={{left:`${ballPoint.x+(carrierSide==="home"?1.5:-1.5)}%`,top:`${ballPoint.y+1}%`}} /></div><aside className="commentary-feed"><div className="panel-title"><span>NARRAÇÃO</span><small>{visibleEvents.length} LANCES</small></div><div className="event-list">{[...visibleEvents].reverse().map((event,index)=><article className={event.type} key={`${event.minute}-${index}`}><strong>{event.minute}&apos;</strong><span>{event.text}</span></article>)}</div></aside></section><footer><div className="match-stat"><span>POSSE</span><b>{plan.homePossession}%</b><i><em style={{width:`${plan.homePossession}%`}}/></i><b>{100-plan.homePossession}%</b></div><div className="match-stat"><span>FINALIZAÇÕES</span><b>{Math.round(plan.homeShots*minute/90)}</b><i><em style={{width:`${plan.homeShots/(plan.homeShots+plan.awayShots)*100}%`}}/></i><b>{Math.round(plan.awayShots*minute/90)}</b></div><div className="match-controls">{minute<90?<><button className="secondary-button" onClick={onToggle}>{running?"PAUSAR":"CONTINUAR"}</button><button className="primary-button" onClick={onSkip}>IR AO FIM ›</button></>:<button className="primary-button" onClick={onFinish}>VOLTAR AO VESTIÁRIO ›</button>}</div></footer></div>;
}

function CareerModal({ game, careers, onClose, onSelect, onCreate, onDelete, onImport, onSync }: { game: GameState; careers: GameState[]; onClose:()=>void; onSelect:(id:string)=>void; onCreate:(manager:string,club:string|undefined,name:string)=>void; onDelete:(id:string)=>void; onImport:(game:GameState)=>void; onSync:(game:GameState)=>void }) {
  const [creating,setCreating]=useState(false); const [manager,setManager]=useState(game.managerName); const [name,setName]=useState("Nova carreira"); const [club,setClub]=useState("random"); const [url,setUrl]=useState(""); const [realTeam,setRealTeam]=useState(userClub(game).name); const [status,setStatus]=useState(""); const fileRef=useRef<HTMLInputElement>(null);
  const exportSave=()=>{ const blob=new Blob([JSON.stringify(game,null,2)],{type:"application/json"}); const link=document.createElement("a"); link.href=URL.createObjectURL(blob); link.download=`eterno-fc-${game.careerName.toLowerCase().replace(/\s+/g,"-")}.json`; link.click(); URL.revokeObjectURL(link.href); };
  const parseImport=(text:string)=>{ try{ const parsed=JSON.parse(text) as unknown; const migrated=migrateGame(parsed); if(!Array.isArray(migrated.clubs)||!Array.isArray(migrated.players)||!Array.isArray(migrated.fixtures)) throw new Error(); onImport({...migrated,id:`import-${Date.now()}`,lastSavedAt:new Date().toISOString()}); setStatus("Carreira importada e atualizada com sucesso."); }catch{ setStatus("Arquivo incompatível com o Eterno FC."); } };
  const fileChange=(event:ChangeEvent<HTMLInputElement>)=>{ const file=event.target.files?.[0]; if(!file)return; const reader=new FileReader(); reader.onload=()=>parseImport(String(reader.result)); reader.readAsText(file); };
  const importUrl=async()=>{ try{ setStatus("Buscando pacote…"); const response=await fetch(url); if(!response.ok)throw new Error(); parseImport(await response.text()); }catch{setStatus("Não foi possível ler esse pacote. Verifique URL, CORS e formato.");} };
  const positionFromSource=(value?:string):Player["position"]=>{ const text=(value??"").toLowerCase(); if(text.includes("goal"))return"GOL"; if(text.includes("right back"))return"LD"; if(text.includes("left back"))return"LE"; if(text.includes("back")||text.includes("defen"))return"ZAG"; if(text.includes("wing"))return text.includes("left")?"PE":"PD"; if(text.includes("attack")||text.includes("forward")||text.includes("striker"))return"ATA"; if(text.includes("mid"))return"MC"; return"MEI"; };
  const syncOfficial=async()=>{ try{ setStatus("Consultando a base esportiva…"); const teamResponse=await fetch(`https://www.thesportsdb.com/api/v1/json/123/searchteams.php?t=${encodeURIComponent(realTeam)}`); if(!teamResponse.ok)throw new Error(); const teamPayload=await teamResponse.json() as {teams?:Array<Record<string,string|null>>}; const team=teamPayload.teams?.find((item)=>item.strSport==="Soccer")??teamPayload.teams?.[0]; if(!team?.idTeam)throw new Error(); const playersResponse=await fetch(`https://www.thesportsdb.com/api/v1/json/123/lookup_all_players.php?id=${team.idTeam}`); if(!playersResponse.ok)throw new Error(); const playerPayload=await playersResponse.json() as {player?:Array<Record<string,string|null>>}; const sourcePlayers=playerPayload.player??[]; const normalized=(value:string)=>value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase(); const matchedClub=game.clubs.find((item)=>normalized(item.name)===normalized(team.strTeam??"")||normalized(item.short)===normalized(team.strTeamShort??"---")); const targetClubId=matchedClub?.id??game.userClubId; const senior=squadFor(game,targetClubId); const sourceIds=new Set(senior.slice(0,sourcePlayers.length).map((player)=>player.id)); const mapped=game.players.map((player)=>{ const index=senior.findIndex((item)=>item.id===player.id); const source=sourcePlayers[index]; if(!source||!sourceIds.has(player.id))return player; const born=source.dateBorn?new Date(`${source.dateBorn}T12:00:00Z`):null; const age=born&&!Number.isNaN(born.getTime())?Math.max(16,game.season-born.getUTCFullYear()):player.age; return {...player,name:source.strPlayer||player.name,position:positionFromSource(source.strPosition??undefined),age,nationality:source.strNationality||player.nationality}; }); const synced:GameState={...game,userClubId:targetClubId,clubs:game.clubs.map((item)=>item.id===targetClubId?{...item,name:team.strTeam||item.name,short:team.strTeamShort||item.short,city:team.strLocation||item.city,stadium:team.strStadium||item.stadium,badge:team.strBadge||undefined}:item),players:mapped,news:[{id:`web-${Date.now()}`,date:game.date,category:"clube",title:`Base real sincronizada: ${team.strTeam}`,body:`Clube, escudo e ${sourcePlayers.length} atleta(s) foram atualizados pela fonte online gratuita. Atributos esportivos continuam sob responsabilidade do motor do jogo.`,unread:true},...game.news]}; onSync(synced); setStatus(`${team.strTeam}: ${sourcePlayers.length} jogadores e dados do clube importados.`); }catch{setStatus("Clube não encontrado ou fonte temporariamente indisponível.");} };
  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Gerenciar carreiras"><div className="career-modal"><header><div><span>ETERNO FC</span><h2>Suas carreiras</h2></div><button onClick={onClose} aria-label="Fechar">×</button></header><section className="career-list">{careers.map((career)=><article className={career.id===game.id?"active":""} key={career.id}><Crest club={userClub(career)}/><div><strong>{career.careerName}</strong><span>{userClub(career).name} • {userLeague(career).short} • {career.season}</span><small>{career.managerName} • salvo {new Date(career.lastSavedAt).toLocaleString("pt-BR")}</small></div><button onClick={()=>onSelect(career.id)}>{career.id===game.id?"Em jogo":"Carregar"}</button>{careers.length>1&&career.id!==game.id&&<button className="delete-career" onClick={()=>onDelete(career.id)}>Excluir</button>}</article>)}</section>{creating?<section className="new-career-form"><label>NOME DA CARREIRA<input value={name} onChange={(event)=>setName(event.target.value)} /></label><label>TREINADOR<input value={manager} onChange={(event)=>setManager(event.target.value)} /></label><label>CLUBE<select value={club} onChange={(event)=>setClub(event.target.value)}><option value="random">SORTEIO DO MUNDO • início aleatório</option>{getAvailableClubs().map((item)=><option value={item.id} key={item.id}>{item.country} • {item.name} • {item.divisionId}</option>)}</select></label><div className="form-actions"><button className="secondary-button" onClick={()=>setCreating(false)}>CANCELAR</button><button className="primary-button" onClick={()=>onCreate(manager,club==="random"?undefined:club,name)} disabled={!name.trim()||!manager.trim()}>COMEÇAR CARREIRA ›</button></div></section>:<button className="new-career-button" onClick={()=>setCreating(true)}>＋ CRIAR NOVA CARREIRA</button>}<section className="official-sync"><div><h3>Começar do futebol real</h3><p>Busque um clube na TheSportsDB. O modo gratuito atualiza dados, escudo e até 10 jogadores; o Eterno FC completa o elenco e calcula os atributos.</p></div><label>NOME EXATO DO CLUBE<div><input value={realTeam} onChange={(event)=>setRealTeam(event.target.value)} placeholder="Ex.: Bahia, Flamengo, Barcelona"/><button onClick={syncOfficial} disabled={!realTeam.trim()}>BUSCAR NA WEB</button></div></label></section><section className="data-tools"><div><h3>Dados e portabilidade</h3><p>Exporte seu mundo inteiro ou importe um pacote Eterno FC em JSON. Saves da primeira versão são migrados automaticamente.</p></div><div className="data-buttons"><button onClick={exportSave}>EXPORTAR SAVE</button><button onClick={()=>fileRef.current?.click()}>IMPORTAR JSON</button><input ref={fileRef} type="file" accept="application/json,.json" onChange={fileChange} hidden /></div><label>URL DE UM PACOTE COMPATÍVEL<div><input value={url} onChange={(event)=>setUrl(event.target.value)} placeholder="https://exemplo.com/carreira.json"/><button onClick={importUrl} disabled={!url}>SINCRONIZAR</button></div></label>{status&&<span className="import-status">{status}</span>}</section></div></div>;
}

export default function Home() {
  const [careers,setCareers]=useState<GameState[]>([]); const [activeId,setActiveId]=useState(""); const [section,setSection]=useState("Visão geral"); const [ready,setReady]=useState(false); const [careerModal,setCareerModal]=useState(false); const [mobileMenu,setMobileMenu]=useState(false); const [matchPlan,setMatchPlan]=useState<MatchPlan|null>(null); const [minute,setMinute]=useState(0); const [running,setRunning]=useState(false); const game=careers.find((career)=>career.id===activeId)??careers[0];

  useEffect(()=>{ const frame=window.requestAnimationFrame(()=>{ try{ const stored=localStorage.getItem(STORAGE_KEY)??localStorage.getItem(LEGACY_STORAGE_KEY); const parsed=stored?JSON.parse(stored) as unknown[]:[]; if(parsed.length){const migrated=parsed.map(migrateGame);setCareers(migrated);setActiveId(localStorage.getItem(ACTIVE_KEY)??localStorage.getItem(LEGACY_ACTIVE_KEY)??migrated[0].id);}else{const first=createNewGame();setCareers([first]);setActiveId(first.id);} }catch{const first=createNewGame();setCareers([first]);setActiveId(first.id);} setReady(true); }); return()=>window.cancelAnimationFrame(frame); },[]);
  useEffect(()=>{ if(!ready||!careers.length)return; localStorage.setItem(STORAGE_KEY,JSON.stringify(careers)); localStorage.setItem(ACTIVE_KEY,activeId); },[careers,activeId,ready]);
  useEffect(()=>{ if(!running||!matchPlan)return; const timer=window.setInterval(()=>setMinute((current)=>{ if(current>=90){setRunning(false);return 90;} return Math.min(90,current+1); }),110); return()=>window.clearInterval(timer); },[running,matchPlan]);

  if(!ready||!game)return <LoadingGame/>;

  const update=(next:GameState)=>setCareers((items)=>items.map((item)=>item.id===game.id?{...next,lastSavedAt:new Date().toISOString()}:item));
  const beginMatch=()=>{if(game.managerStatus==="unemployed"){setSection("Carreira");return;}const fixture=nextUserFixture(game);if(!fixture)return;setMatchPlan(buildMatchPlan(game,fixture));setMinute(0);setRunning(true);};
  const finishMatch=()=>{if(!matchPlan)return;update(finishRound(game,matchPlan));setMatchPlan(null);setMinute(0);setRunning(false);setSection("Visão geral");};
  const createCareer=(manager:string,club:string|undefined,name:string)=>{const next={...createNewGame(manager,club,name),id:`career-${Date.now()}`};setCareers((items)=>[...items,next]);setActiveId(next.id);setCareerModal(false);setSection("Visão geral");};
  const importCareer=(next:GameState)=>{setCareers((items)=>[...items,next]);setActiveId(next.id);};
  const currentClub=userClub(game); const unread=game.news.filter((item)=>item.unread).length;

  const renderSection=()=>{
    if(section==="Elenco")return <SquadView game={game} update={update}/>;
    if(section==="Táticas")return <TacticsView game={game} update={update}/>;
    if(section==="Calendário")return <CalendarView game={game} onPlay={beginMatch}/>;
    if(section==="Competições")return <CompetitionView game={game}/>;
    if(section==="Mercado")return <MarketView game={game} update={update}/>;
    if(section==="Categorias de base")return <AcademyView game={game} update={update}/>;
    if(section==="Finanças")return <FinanceView game={game}/>;
    if(section==="Carreira")return <CareerView game={game} update={update}/>;
    if(section==="Notícias")return <NewsView game={game}/>;
    return <Dashboard game={game} onPlay={beginMatch} onSection={setSection} onNextSeason={()=>update(startNextSeason(game))}/>;
  };

  return (
    <main className="game-shell">
      <aside className="sidebar">
        <button className="brand" onClick={()=>setSection("Visão geral")}><span className="brand-mark">E</span><span><strong>ETERNO</strong><small>FUTEBOL CLUBE</small></span></button>
        <nav className="primary-nav" aria-label="Menu principal">{NAV_ITEMS.map(([name,number])=><button key={name} className={section===name?"active":""} onClick={()=>setSection(name)}><span>{number}</span>{name}</button>)}</nav>
        <div className="sidebar-bottom"><button className="save-button" onClick={()=>setCareerModal(true)}><span className="save-dot"/>Gerenciar saves e dados</button><button className="manager-card" onClick={()=>setSection("Carreira")}><span className="avatar">{game.managerName.split(" ").map((part)=>part[0]).slice(0,2).join("")}</span><span><strong>{game.managerName}</strong><small>{game.managerStatus==="unemployed"?"Sem clube":`${currentClub.name} • ${userLeague(game).short}`}</small></span><b>•••</b></button></div>
      </aside>

      <section className="workspace">
        <header className="topbar"><button className="mobile-brand" onClick={()=>setCareerModal(true)}><span className="brand-mark">E</span><strong>ETERNO FC</strong></button><div className="season-pill"><span>{currentClub.country.toUpperCase()} • {game.season}</span><strong>{formatGameDate(game.date,true).toUpperCase()}</strong></div><div className="top-actions"><button aria-label={`${unread} notificações`} className="notification" onClick={()=>setSection("Notícias")}>{unread}</button><button className="advance-button" onClick={game.managerStatus==="unemployed"?()=>setSection("Carreira"):seasonIsOver(game)?()=>update(startNextSeason(game)):beginMatch}>{game.managerStatus==="unemployed"?"VER VAGAS":seasonIsOver(game)?"NOVA TEMPORADA":"PRÓXIMA PARTIDA"}<span>›</span></button></div></header>
        <div className="content">{renderSection()}</div>
        {mobileMenu&&<div className="mobile-more-menu" role="dialog" aria-label="Mais seções">{NAV_ITEMS.slice(5).map(([name,number])=><button key={name} className={section===name?"active":""} onClick={()=>{setSection(name);setMobileMenu(false);}}><span>{number}</span><strong>{name}</strong></button>)}<button onClick={()=>{setMobileMenu(false);setCareerModal(true);}}><span>＋</span><strong>Saves e dados</strong></button></div>}
        <nav className="mobile-nav" aria-label="Navegação móvel">{NAV_ITEMS.slice(0,5).map(([name,number])=><button key={name} className={section===name?"active":""} onClick={()=>{setSection(name);setMobileMenu(false);}}><span>{number}</span>{name.split(" ")[0]}</button>)}<button className={NAV_ITEMS.slice(5).some(([name])=>name===section)?"active":""} onClick={()=>setMobileMenu((value)=>!value)} aria-expanded={mobileMenu}><span>•••</span>Mais</button></nav>
      </section>

      {matchPlan && (
        <MatchCenter game={game} plan={matchPlan} minute={minute} running={running} onToggle={()=>setRunning((value)=>!value)} onSkip={()=>{setMinute(90);setRunning(false);}} onFinish={finishMatch} onClose={()=>{if(minute===0||minute>=90){setMatchPlan(null);setRunning(false);}}}/>
      )}
      {careerModal && (
        <CareerModal game={game} careers={careers} onClose={()=>setCareerModal(false)} onSelect={(id)=>{setActiveId(id);setSection("Visão geral");setCareerModal(false);}} onCreate={createCareer} onDelete={(id)=>setCareers((items)=>items.filter((item)=>item.id!==id))} onImport={importCareer} onSync={update}/>
      )}
    </main>
  );
}

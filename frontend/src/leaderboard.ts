// The overall top 25 and the player's own top 10 for each game mode, cached from the backend, and the
// flow that submits a finished run. The server re-checks every submission, so the checks here only
// save needless requests.
import { ApiError, getLeaderboard, getMyScores, postLeaderboard, postScore, type Entry } from './api'
import { GAME_MODES, type GameModeId } from './gameMode'
import { getOnline } from './online'
import { getAccount, getUsername, setAccount } from './player'

export const BOARD_SIZE = 25

export type Board = { overall: Entry[]; mine: Entry[] }

const empty: Board = { overall: [], mine: [] }
let boards = Object.fromEntries(GAME_MODES.map((mode) => [mode.id, empty])) as Record<GameModeId, Board>

const listeners = new Set<() => void>()
export const subscribeBoards = (listener: () => void) => {
  listeners.add(listener)
  return () => void listeners.delete(listener)
}
export const getBoard = (mode: GameModeId) => boards[mode]

function setBoard(mode: GameModeId, patch: Partial<Board>) {
  boards = { ...boards, [mode]: { ...boards[mode], ...patch } }
  listeners.forEach((listener) => listener())
}

// Reloads both lists for one mode. A failed request keeps whatever was showing.
export async function refreshBoard(mode: GameModeId) {
  const username = getUsername()
  const [overall, mine] = await Promise.allSettled([
    getLeaderboard(mode),
    username ? getMyScores(mode, username) : Promise.resolve([] as Entry[]),
  ])
  setBoard(mode, {
    ...(overall.status === 'fulfilled' && { overall: overall.value }),
    ...(mine.status === 'fulfilled' && { mine: mine.value }),
  })
}

// What happened to a finished run, for the game over screen.
export type RunResult = 'none' | 'top10' | 'leaderboard' | 'offline'

export async function submitRun(mode: GameModeId, score: number): Promise<RunResult> {
  const account = getAccount()
  // Offline play has no scores to save.
  if (getOnline() !== 'online' || !account || score < 1) return 'none'
  try {
    const { accepted } = await postScore(mode, account, score)
    if (!accepted) return 'none'

    // Only a score above the lowest on a full board (or any score on a board with room) is worth posting.
    const overall = await getLeaderboard(mode)
    const lowest = overall.length >= BOARD_SIZE ? overall[overall.length - 1].score : 0
    let result: RunResult = 'top10'
    if (score > lowest) {
      const posted = await postLeaderboard(mode, account, score)
      if (posted.accepted) result = 'leaderboard'
    }
    await refreshBoard(mode)
    return result
  } catch (error) {
    // The saved login no longer works (for example a reset database): sign in again from the home screen.
    if (error instanceof ApiError && (error.status === 401 || error.status === 404)) setAccount(null)
    return 'offline'
  }
}

import Hero from '@/app/components/Hero'
import ActivateButton from '@/app/components/ActivateButton'
import ProtocolVitals from '@/app/components/ProtocolVitals'
import SelfSustainingLoop from '@/app/components/SelfSustainingLoop'
import dynamic from 'next/dynamic'

const AgentTerminal  = dynamic(() => import('@/app/components/AgentTerminal'),  { ssr: false })
const AgentStatusBar = dynamic(() => import('@/app/components/AgentStatusBar'), { ssr: false })

export default function Home() {
  return (
    <main>
      <Hero />
      <ActivateButton />
      <AgentTerminal />
      <AgentStatusBar />
      <ProtocolVitals />
      <SelfSustainingLoop />
    </main>
  )
}

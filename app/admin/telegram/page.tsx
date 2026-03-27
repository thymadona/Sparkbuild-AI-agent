import TelegramClient from './TelegramClient'

export default function TelegramPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-100">Telegram</h1>
        <p className="text-sm text-gray-500 mt-0.5">Look up parent chat IDs for invoice notifications</p>
      </div>
      <TelegramClient />
    </div>
  )
}

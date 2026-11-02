import { defineStrings } from '@/i18n'

export const whatsNewStrings = defineStrings({
  en: {
    title: "What's new",
    intro: 'Changes to the app, newest first.',
    empty: 'Nothing here yet.',
    banner: (n: number) => `New in the app: ${n === 1 ? '1 change' : `${n} changes`}`,
    read: 'See what changed',
    dismiss: 'Hide',
    unseen: 'New changes',
  },
  sv: {
    title: 'Nytt i appen',
    intro: 'Ändringar i appen, senaste först.',
    empty: 'Inget här än.',
    banner: (n: number) => `Nytt i appen: ${n === 1 ? '1 ändring' : `${n} ändringar`}`,
    read: 'Se vad som är nytt',
    dismiss: 'Dölj',
    unseen: 'Nya ändringar',
  },
})

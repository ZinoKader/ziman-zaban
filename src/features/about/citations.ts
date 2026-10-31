/** Bibliographic data for the research cited on the About page. Findings (translated) live in strings.ts. */
export interface Citation {
  authors: string
  year: number
  title: string
  venue: string
  doi?: string
}

export const CITATIONS = {
  rowland2014: {
    authors: 'Rowland, C. A.',
    year: 2014,
    title: 'The effect of testing versus restudy on retention: A meta-analytic review of the testing effect',
    venue: 'Psychological Bulletin, 140(6), 1432–1463',
    doi: '10.1037/a0037559',
  },
  roediger2011: {
    authors: 'Roediger, H. L., & Butler, A. C.',
    year: 2011,
    title: 'The critical role of retrieval practice in long-term retention',
    venue: 'Trends in Cognitive Sciences, 15(1), 20–27',
    doi: '10.1016/j.tics.2010.09.003',
  },
  cepeda2006: {
    authors: 'Cepeda, N. J., Pashler, H., Vul, E., Wixted, J. T., & Rohrer, D.',
    year: 2006,
    title: 'Distributed practice in verbal recall tasks: A review and quantitative synthesis',
    venue: 'Psychological Bulletin, 132(3), 354–380',
    doi: '10.1037/0033-2909.132.3.354',
  },
  ye2022: {
    authors: 'Ye, J., Su, J., & Cao, Y.',
    year: 2022,
    title: 'A stochastic shortest path algorithm for optimizing spaced repetition scheduling',
    venue: 'Proceedings of the 28th ACM SIGKDD Conference on Knowledge Discovery and Data Mining',
  },
  metcalfe2017: {
    authors: 'Metcalfe, J.',
    year: 2017,
    title: 'Learning from errors',
    venue: 'Annual Review of Psychology, 68, 465–489',
    doi: '10.1146/annurev-psych-010416-044022',
  },
  webb2009: {
    authors: 'Webb, S.',
    year: 2009,
    title: 'The effects of receptive and productive learning of word pairs on vocabulary knowledge',
    venue: 'RELC Journal, 40(3), 360–376',
  },
  belardi2021: {
    authors: 'Belardi, A., Pedrett, S., Rothen, N., & Reber, T. P.',
    year: 2021,
    title: 'Spacing, feedback, and testing boost vocabulary learning in a web application',
    venue: 'Frontiers in Psychology, 12, 757262',
    doi: '10.3389/fpsyg.2021.757262',
  },
  muramoto2023: {
    authors: 'Muramoto, D., Kato, T., Tamura, A., & Yamamoto, S.',
    year: 2023,
    title:
      'Retention effects of form-focused English speaking training based on question-answering task in comparison with repeating task using robot-assisted language learning system',
    venue: '9th Workshop on Speech and Language Technology in Education (SLaTE), Dublin',
    doi: '10.21437/SLaTE.2023-22',
  },
  bibauw2019: {
    authors: 'Bibauw, S., François, T., & Desmet, P.',
    year: 2019,
    title: 'Discussing with a computer to practice a foreign language: Research synthesis and conceptual framework of dialogue-based CALL',
    venue: 'Computer Assisted Language Learning',
    doi: '10.1080/09588221.2018.1535508',
  },
  pitura2023: {
    authors: 'Pitura, J., & Chang, H.',
    year: 2023,
    title: 'Tools for scaffolding the development of L2 speaking in English-medium higher education: Lessons from Poland and Australia',
    venue: 'Theory and Practice of Second Language Acquisition, 9(2)',
    doi: '10.31261/TAPSLA.12816',
  },
  nakaya2016: {
    authors: 'Nakaya, K., & Murota, M.',
    year: 2016,
    title: 'Development of a mobile application for listening and scaffolded autonomous summary speaking and its effectiveness for increasing fluency',
    venue: 'The Journal of Information and Systems in Education',
  },
  kornell2010: {
    authors: 'Kornell, N., Castel, A. D., Eich, T. S., & Bjork, R. A.',
    year: 2010,
    title: 'Spacing as the friend of both memory and induction in young and older adults',
    venue: 'Psychology and Aging, 25(2), 498–503',
    doi: '10.1037/a0017807',
  },
  puntambekar2005: {
    authors: 'Puntambekar, S., & Hubscher, R.',
    year: 2005,
    title: 'Tools for scaffolding students in a complex learning environment: What have we gained and what have we missed?',
    venue: 'Educational Psychologist, 40(1), 1–12',
  },
} satisfies Record<string, Citation>

export type CitationId = keyof typeof CITATIONS

export const PRINCIPLES = [
  { id: 'retrieval', cites: ['rowland2014', 'roediger2011'] },
  { id: 'spacing', cites: ['cepeda2006', 'ye2022'] },
  { id: 'feedback', cites: ['metcalfe2017', 'belardi2021'] },
  { id: 'direction', cites: ['webb2009', 'belardi2021'] },
  { id: 'questions', cites: ['muramoto2023'] },
  { id: 'dialogue', cites: ['bibauw2019'] },
  { id: 'scaffolding', cites: ['pitura2023', 'nakaya2016'] },
  { id: 'webapp', cites: ['belardi2021'] },
  { id: 'interleaving', cites: ['kornell2010'] },
  { id: 'romanization', cites: ['puntambekar2005'] },
] as const satisfies ReadonlyArray<{ id: string; cites: readonly CitationId[] }>

export type PrincipleId = (typeof PRINCIPLES)[number]['id']

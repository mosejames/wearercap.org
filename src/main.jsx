import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowDownToLine,
  Check,
  ChevronDown,
  Clipboard,
  Eye,
  FileCode2,
  ImagePlus,
  LayoutTemplate,
  Monitor,
  Moon,
  PanelLeft,
  Redo2,
  RotateCcw,
  Save,
  Smartphone,
  Sun,
  Trash2,
  Undo2,
} from 'lucide-react';
import './styles.css';

const assetBase = 'https://mosejames.github.io/rcap-exp-2026/img/';

const image = (file, alt) => ({
  src: `${assetBase}${file}`,
  alt,
});

const originalNewsletter = {
  meta: {
    title: 'RCAP — What to EXPECT at EXP',
    description:
      'Our first summer EXP — RCAP showed up and showed out. See what a day on the team looks like, and find your place at the next one.',
  },
  masthead: {
    brand: 'RCAP',
    brandSub: 'Ron Clark Academy Parents',
    issue: 'EXP Recap',
    issueDetail: 'First Summer EXP · 2026',
  },
  hero: {
    topKicker: 'What to expect at EXP',
    eyebrow: 'RCAP showed up and showed out.',
    title: 'We are the welcome.',
    highlight: 'welcome.',
    image: image('hero-celebrate.jpg', 'Two RCAP volunteers celebrating at EXP'),
  },
  expect: {
    lead: "Here's what a day on the team looks like",
    lines: ['community.', 'service.', 'to be tired.', 'to have fun.'],
  },
  letter: {
    greeting: 'Dear Ron Clark Academy Families,',
    lede: 'Today was our first summer EXP — and RCAP showed up and showed out.',
    body: 'Parents spent the day doing a hundred things, big and small, that helped make the day a success:',
    chips: [
      'greeting guests',
      'directing traffic',
      'guiding educators',
      'registration',
      'serving meals',
      'flipping rooms',
      'taking photos',
      'answering questions',
    ],
  },
  stat: {
    value: '1,000+',
    label: 'Educators welcomed — from across the country & the world',
  },
  sections: [
    {
      number: '01',
      kicker: 'Arrival & parking',
      title: 'The first thing visitors experience is us.',
      highlight: 'us.',
      body:
        'Some educators arrive on charter buses. Others drive themselves. Some take an Uber. Every now and then, someone even pulls up in a driverless car. However they arrive, we help them feel welcome from the moment they step onto campus.',
      tint: false,
      heroImage: image('arrival-traffic-wide.jpg', 'A volunteer directs traffic with a signal baton'),
      heroCaption: 'Before the first session begins, the parking lot is already a team sport.',
      gallery: [
        image('arrival-walk.jpg', 'Volunteer in an XPERTS shirt walking up to campus'),
        image('arrival-pair.jpg', 'Two Men of RCAP volunteers walking together'),
      ],
      closingCaption:
        "A smile, a greeting, a quick answer to a question. It seems small — but it sets the tone for someone's entire day.",
    },
    {
      number: '02',
      kicker: 'Registration',
      title: 'A thousand educators. One smooth check-in.',
      highlight: 'check-in.',
      body:
        'With more than 1,000 educators on campus, registration is a major operation. Volunteers hand out name badges, schedules, notebooks, and materials — and make sure everyone gets exactly where they need to go.',
      tint: false,
      heroImage: image('reg-handoff.jpg', 'Volunteer handing materials to a guest at the registration booth'),
      heroCaption: 'Badges, schedules, notebooks, a warm hello — handed over hundreds of times before lunch.',
      subhead: 'Studying the playbook',
      subcopy:
        'Before a single group moves, parents pore over the schedules — mapping who goes where, and when, so the whole day flows.',
      gallery: [
        image('reg-red.jpg', 'Volunteer working a registration table'),
        image('reg-blue.jpg', 'Volunteer writing at a registration booth'),
        image('reg-cap.jpg', 'Volunteer filling out paperwork'),
      ],
    },
    {
      number: '03',
      kicker: 'Keeping everyone moving',
      title: "It looks effortless. It's teamwork.",
      highlight: 'teamwork.',
      body:
        "Under the steady command of Mr. Walker — RCA's unofficial Director of Educator Movement — parents help guide group after group through the building. It looks effortless when it works well, but keeping a thousand educators flowing smoothly from room to room takes real coordination and teamwork.",
      tint: true,
      heroImage: image('hall-lead.jpg', 'Volunteer leading a group of educators down a hallway'),
      heroCaption: 'Follow the leader: a group of educators move to their next session.',
      gallery: [
        image('hall-signE.jpg', 'Volunteer holding a FOLLOW ME group sign'),
        image('hall-sign9.jpg', 'Volunteer raising a group number sign outside the entrance'),
      ],
      featureImage: image('hall-door12.jpg', 'Guests entering through the blue dragon doors as a volunteer guides them'),
      featureCaption: '"Group 12, right this way." Every sign held high is one less educator who feels lost.',
    },
    {
      number: '04',
      kicker: 'Flipping rooms & serving meals',
      title: 'Tables appear, disappear, and reappear.',
      highlight: 'reappear.',
      body:
        "If you've ever watched an EXP day unfold, you've seen rooms transform again and again. Tables move. Meals are served. Sessions begin. Spaces are reimagined. It's a lot of work — and it only happens because parents jump in wherever they're needed.",
      tint: false,
      gallery: [
        image('setup-chairs.jpg', 'Volunteer carrying a stack of folding chairs to reset a room'),
        image('meal-trays.jpg', 'Volunteer setting out boxed meals on a table'),
      ],
      featureImage: image('meal-table-2.jpg', 'Smiling meal-support volunteer in an XPERTS shirt, hands on hips'),
      featureCaption: 'Meal support runs on volunteers who show up early and smile straight through the rush.',
    },
    {
      number: '05',
      kicker: 'The people you meet',
      title: 'The unexpected benefit of showing up.',
      highlight: 'showing up.',
      body:
        "You'll meet educators from all over the world. You'll run into old friends. You'll hear incredible stories. And every now and then, you'll catch a glimpse of an RCA lesson in action — and walk away with an even deeper appreciation for what happens inside these walls every day.",
      tint: false,
      heroImage: image('bw-connect.jpg', 'Two volunteers sharing a laugh together'),
      heroCaption:
        "Old friends, new friends, and the kind of laugh you only get when you're in it together.",
      gallery: [
        image('joy-heart.jpg', 'Volunteer making a heart with her hands'),
        image('joy-fan.jpg', 'Two volunteers posing together'),
      ],
    },
    {
      number: '06',
      kicker: 'The real stars',
      title: 'Of course, the day belonged to our students.',
      highlight: 'students.',
      body:
        'Our students represented RCA beautifully and reminded us why educators travel thousands of miles to see what makes this place so special.',
      tint: 'students',
      wordStack: ['Polos.', 'Khakis.', 'Smiles.', 'Leadership.'],
      heroImage: image(
        'students-group.jpg',
        'Six Ron Clark Academy students in red and blue polos, arms around each other, smiling',
      ),
      heroCaption: 'Freshly washed and ironed polos. Khakis. And smiles for days.',
    },
  ],
  quotes: [
    {
      afterSection: 0,
      text: 'One of the first things visitors experience when they arrive at RCA is us.',
      by: '',
    },
    {
      afterSection: 3,
      text: "It only happens because parents jump in wherever they're needed.",
      by: '— Behind every flipped room',
    },
  ],
  thanks: {
    kicker: 'From all of us at RCAP',
    title: 'Thank you.',
    body: 'To every parent, student, staff member, alumni volunteer, and family member who helped make today a success.',
    gallery: [
      image('team-trio.jpg', 'Three volunteers smiling together'),
      image('joy-peace.jpg', 'Volunteer throwing a peace sign'),
      image('joy-laugh.jpg', 'Volunteer laughing at registration'),
      image('joy-trio.jpg', 'Three volunteers hugging outside'),
      image('candid-look.jpg', 'Volunteer looking up from her work'),
      image('joy-mural.jpg', 'Volunteers posing in front of the RCA mural'),
    ],
  },
  ctas: [
    {
      kicker: 'Calls to action · 03',
      title: 'Sign up for upcoming EXP days',
      body: "Whether you've volunteered a hundred times or never once, there's a place for you.",
      label: 'Reserve my spot',
      url: 'https://www.signupgenius.com/go/60B0949A4AB29A2F94-rcaexp2#/',
      style: 'feature',
      datesLabel: 'Additional EXP dates',
      dates: [
        'Wed · Jun 3',
        'Fri · Jun 5',
        'Sat · Jun 6 — Full',
        'Sat · Jul 18',
        'Sun · Jul 19',
        'Tue · Jul 21',
        'Wed · Jul 22',
        'Fri · Jul 24',
        'Sat · Jul 25',
      ],
    },
    {
      kicker: 'Calls to action · 01',
      title: "View today's photo gallery",
      body: 'Relive the whole day — and add your own shots so we capture every moment from every angle.',
      label: 'View & add photos',
      url: 'https://photos.app.goo.gl/95HnN6KXtEdoDkWJ6',
      style: 'dark',
    },
    {
      kicker: 'Calls to action · 02',
      title: 'Log your volunteer hours',
      body: "Track your hours all year with Track It Forward — and today's EXP is a great head start.",
      label: 'Log my hours',
      url: 'https://www.trackitforward.com/site/the-ron-clark-academy',
      style: 'ghost',
    },
  ],
  closing: {
    noteKicker: 'One more thing',
    note:
      "Not every email from us will look like this one — some are just a quick hello and a date to circle. But this one felt worth dressing up. We're at the start of something good, and we want you in it. Come build it with us.",
    lede: "We're already looking ahead to the next EXP — and we'd love to have you join us.",
    signoff: 'With gratitude,',
    name: 'Your RCAP Family',
    role: 'Ron Clark Academy Parents',
  },
  footer: {
    tags: '#RCAEXP · #RCAPINSPIRED · #RONCLARKACADEMY',
    address: "Ron Clark Academy Parents · Atlanta, GA\nYou're receiving this because you're part of the RCA family.",
  },
};

const storageKey = 'rcap-newsletter-builder:v1';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function App() {
  const [newsletter, setNewsletter] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : clone(originalNewsletter);
    } catch {
      return clone(originalNewsletter);
    }
  });
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);
  const [activePanel, setActivePanel] = useState('story');
  const [activeSection, setActiveSection] = useState(0);
  const [previewMode, setPreviewMode] = useState('desktop');
  const [themeMode, setThemeMode] = useState('warm');
  const [copied, setCopied] = useState(false);
  const importRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(newsletter));
  }, [newsletter]);

  const generatedHtml = useMemo(() => buildExportHtml(newsletter), [newsletter]);

  const commit = (recipe) => {
    setNewsletter((current) => {
      const next = clone(current);
      recipe(next);
      setHistory((items) => [...items.slice(-24), current]);
      setFuture([]);
      return next;
    });
  };

  const undo = () => {
    setHistory((items) => {
      if (!items.length) return items;
      const previous = items[items.length - 1];
      setFuture((redoItems) => [newsletter, ...redoItems].slice(0, 25));
      setNewsletter(previous);
      return items.slice(0, -1);
    });
  };

  const redo = () => {
    setFuture((items) => {
      if (!items.length) return items;
      const next = items[0];
      setHistory((undoItems) => [...undoItems.slice(-24), newsletter]);
      setNewsletter(next);
      return items.slice(1);
    });
  };

  const reset = () => {
    commit((next) => {
      Object.assign(next, clone(originalNewsletter));
    });
    setActiveSection(0);
  };

  const download = (name, contents, type = 'text/html') => {
    const blob = new Blob([contents], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
  };

  const copyHtml = async () => {
    await navigator.clipboard.writeText(generatedHtml);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const importJson = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        commit((next) => Object.assign(next, parsed));
      } catch {
        alert('That file was not valid newsletter JSON.');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  return (
    <div className={`app-shell theme-${themeMode}`}>
      <TopBar
        history={history}
        future={future}
        undo={undo}
        redo={redo}
        reset={reset}
        copyHtml={copyHtml}
        copied={copied}
        exportHtml={() => download('rcap-newsletter.html', generatedHtml)}
        exportJson={() =>
          download(
            'rcap-newsletter-data.json',
            JSON.stringify(newsletter, null, 2),
            'application/json',
          )
        }
        importRef={importRef}
        importJson={importJson}
        previewMode={previewMode}
        setPreviewMode={setPreviewMode}
        themeMode={themeMode}
        setThemeMode={setThemeMode}
      />
      <main className="workspace">
        <aside className="editor-shell" aria-label="Newsletter editor">
          <PanelTabs activePanel={activePanel} setActivePanel={setActivePanel} />
          {activePanel === 'story' && (
            <StoryEditor
              newsletter={newsletter}
              commit={commit}
              activeSection={activeSection}
              setActiveSection={setActiveSection}
            />
          )}
          {activePanel === 'design' && (
            <DesignEditor newsletter={newsletter} commit={commit} themeMode={themeMode} setThemeMode={setThemeMode} />
          )}
          {activePanel === 'export' && (
            <ExportPanel
              newsletter={newsletter}
              generatedHtml={generatedHtml}
              copyHtml={copyHtml}
              copied={copied}
              exportHtml={() => download('rcap-newsletter.html', generatedHtml)}
              exportJson={() =>
                download(
                  'rcap-newsletter-data.json',
                  JSON.stringify(newsletter, null, 2),
                  'application/json',
                )
              }
              importRef={importRef}
              importJson={importJson}
            />
          )}
        </aside>
        <section className="preview-stage" aria-label="Live newsletter preview">
          <div className="preview-toolbar">
            <div>
              <p>{newsletter.meta.title}</p>
              <span>{previewMode === 'mobile' ? 'Mobile width' : 'Desktop email width'}</span>
            </div>
            <div className="preview-buttons" role="group" aria-label="Preview width">
              <IconButton
                title="Desktop preview"
                active={previewMode === 'desktop'}
                onClick={() => setPreviewMode('desktop')}
              >
                <Monitor size={17} />
              </IconButton>
              <IconButton
                title="Mobile preview"
                active={previewMode === 'mobile'}
                onClick={() => setPreviewMode('mobile')}
              >
                <Smartphone size={17} />
              </IconButton>
            </div>
          </div>
          <div className={`preview-scroll ${previewMode}`}>
            <NewsletterPreview newsletter={newsletter} />
          </div>
        </section>
      </main>
    </div>
  );
}

function TopBar({
  history,
  future,
  undo,
  redo,
  reset,
  copyHtml,
  copied,
  exportHtml,
  exportJson,
  importRef,
  importJson,
  previewMode,
  setPreviewMode,
  themeMode,
  setThemeMode,
}) {
  return (
    <header className="topbar">
      <div className="topbar-brand">
        <div className="builder-mark">RCA<span>P</span></div>
        <div>
          <h1>Newsletter Builder</h1>
          <p>EXP recap template</p>
        </div>
      </div>
      <div className="topbar-actions">
        <div className="icon-group">
          <IconButton title="Undo" disabled={!history.length} onClick={undo}>
            <Undo2 size={17} />
          </IconButton>
          <IconButton title="Redo" disabled={!future.length} onClick={redo}>
            <Redo2 size={17} />
          </IconButton>
          <IconButton title="Reset to original" onClick={reset}>
            <RotateCcw size={17} />
          </IconButton>
        </div>
        <div className="segmented" role="group" aria-label="Preview mode">
          <button className={previewMode === 'desktop' ? 'active' : ''} onClick={() => setPreviewMode('desktop')}>
            <Monitor size={15} />
            <span>Wide</span>
          </button>
          <button className={previewMode === 'mobile' ? 'active' : ''} onClick={() => setPreviewMode('mobile')}>
            <Smartphone size={15} />
            <span>Narrow</span>
          </button>
        </div>
        <div className="segmented" role="group" aria-label="Builder theme">
          <button className={themeMode === 'warm' ? 'active' : ''} onClick={() => setThemeMode('warm')}>
            <Sun size={15} />
            <span>Warm</span>
          </button>
          <button className={themeMode === 'focus' ? 'active' : ''} onClick={() => setThemeMode('focus')}>
            <Moon size={15} />
            <span>Focus</span>
          </button>
        </div>
        <button className="command ghost" onClick={() => importRef.current?.click()}>
          <ArrowDownToLine size={16} />
          Import
        </button>
        <input ref={importRef} type="file" accept="application/json" onChange={importJson} hidden />
        <button className="command ghost" onClick={exportJson}>
          <Save size={16} />
          Data
        </button>
        <button className="command ghost" onClick={copyHtml}>
          {copied ? <Check size={16} /> : <Clipboard size={16} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
        <button className="command primary" onClick={exportHtml}>
          <FileCode2 size={16} />
          HTML
        </button>
      </div>
    </header>
  );
}

function PanelTabs({ activePanel, setActivePanel }) {
  const tabs = [
    ['story', LayoutTemplate, 'Story'],
    ['design', PanelLeft, 'Design'],
    ['export', FileCode2, 'Export'],
  ];
  return (
    <nav className="panel-tabs" aria-label="Editor areas">
      {tabs.map(([id, Icon, label]) => (
        <button key={id} className={activePanel === id ? 'active' : ''} onClick={() => setActivePanel(id)}>
          <Icon size={16} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

function StoryEditor({ newsletter, commit, activeSection, setActiveSection }) {
  const section = newsletter.sections[activeSection];
  return (
    <div className="editor-scroll">
      <EditorGroup title="Masthead">
        <TextInput label="Issue" value={newsletter.masthead.issue} onChange={(value) => commit((n) => (n.masthead.issue = value))} />
        <TextInput
          label="Issue detail"
          value={newsletter.masthead.issueDetail}
          onChange={(value) => commit((n) => (n.masthead.issueDetail = value))}
        />
      </EditorGroup>
      <EditorGroup title="Hero">
        <TextInput label="Kicker" value={newsletter.hero.topKicker} onChange={(value) => commit((n) => (n.hero.topKicker = value))} />
        <TextInput label="Eyebrow" value={newsletter.hero.eyebrow} onChange={(value) => commit((n) => (n.hero.eyebrow = value))} />
        <TextInput label="Headline" value={newsletter.hero.title} onChange={(value) => commit((n) => (n.hero.title = value))} />
        <TextInput label="Highlighted word" value={newsletter.hero.highlight} onChange={(value) => commit((n) => (n.hero.highlight = value))} />
        <ImageInput
          label="Hero image"
          image={newsletter.hero.image}
          onChange={(img) => commit((n) => (n.hero.image = img))}
        />
      </EditorGroup>
      <EditorGroup title="Expect Lines">
        <TextInput label="Lead" value={newsletter.expect.lead} onChange={(value) => commit((n) => (n.expect.lead = value))} />
        {newsletter.expect.lines.map((line, index) => (
          <TextInput
            key={index}
            label={`Line ${index + 1}`}
            value={line}
            onChange={(value) => commit((n) => (n.expect.lines[index] = value))}
          />
        ))}
      </EditorGroup>
      <EditorGroup title="Opening Letter">
        <TextInput label="Greeting" value={newsletter.letter.greeting} onChange={(value) => commit((n) => (n.letter.greeting = value))} />
        <TextArea label="Lede" value={newsletter.letter.lede} onChange={(value) => commit((n) => (n.letter.lede = value))} />
        <TextArea label="Body" value={newsletter.letter.body} onChange={(value) => commit((n) => (n.letter.body = value))} />
        <TextArea
          label="Chips"
          value={newsletter.letter.chips.join('\n')}
          onChange={(value) => commit((n) => (n.letter.chips = lines(value)))}
        />
      </EditorGroup>
      <EditorGroup title="Stat Band">
        <TextInput label="Value" value={newsletter.stat.value} onChange={(value) => commit((n) => (n.stat.value = value))} />
        <TextInput label="Label" value={newsletter.stat.label} onChange={(value) => commit((n) => (n.stat.label = value))} />
      </EditorGroup>
      <EditorGroup title="Story Sections">
        <SelectInput
          label="Active section"
          value={String(activeSection)}
          onChange={(value) => setActiveSection(Number(value))}
          options={newsletter.sections.map((item, index) => ({
            value: String(index),
            label: `${item.number} ${item.kicker}`,
          }))}
        />
        <div className="dual-fields">
          <TextInput label="Number" value={section.number} onChange={(value) => commit((n) => (n.sections[activeSection].number = value))} />
          <TextInput label="Kicker" value={section.kicker} onChange={(value) => commit((n) => (n.sections[activeSection].kicker = value))} />
        </div>
        <TextInput label="Title" value={section.title} onChange={(value) => commit((n) => (n.sections[activeSection].title = value))} />
        <TextInput label="Highlight" value={section.highlight || ''} onChange={(value) => commit((n) => (n.sections[activeSection].highlight = value))} />
        <TextArea label="Body" value={section.body || ''} onChange={(value) => commit((n) => (n.sections[activeSection].body = value))} />
        <SelectInput
          label="Background"
          value={String(section.tint)}
          onChange={(value) =>
            commit((n) => {
              n.sections[activeSection].tint = value === 'false' ? false : value === 'true' ? true : value;
            })
          }
          options={[
            { value: 'false', label: 'Paper' },
            { value: 'true', label: 'Soft band' },
            { value: 'students', label: 'Student feature' },
          ]}
        />
        {section.wordStack && (
          <TextArea
            label="Word stack"
            value={section.wordStack.join('\n')}
            onChange={(value) => commit((n) => (n.sections[activeSection].wordStack = lines(value)))}
          />
        )}
        {section.heroImage && (
          <ImageInput
            label="Lead image"
            image={section.heroImage}
            onChange={(img) => commit((n) => (n.sections[activeSection].heroImage = img))}
          />
        )}
        {section.heroCaption !== undefined && (
          <TextArea
            label="Lead caption"
            value={section.heroCaption || ''}
            onChange={(value) => commit((n) => (n.sections[activeSection].heroCaption = value))}
          />
        )}
        {section.subhead !== undefined && (
          <>
            <TextInput label="Subhead" value={section.subhead || ''} onChange={(value) => commit((n) => (n.sections[activeSection].subhead = value))} />
            <TextArea label="Subcopy" value={section.subcopy || ''} onChange={(value) => commit((n) => (n.sections[activeSection].subcopy = value))} />
          </>
        )}
        <GalleryEditor
          label="Gallery images"
          images={section.gallery || []}
          onChange={(images) => commit((n) => (n.sections[activeSection].gallery = images))}
        />
        {section.featureImage && (
          <ImageInput
            label="Feature image"
            image={section.featureImage}
            onChange={(img) => commit((n) => (n.sections[activeSection].featureImage = img))}
          />
        )}
        {section.featureCaption !== undefined && (
          <TextArea
            label="Feature caption"
            value={section.featureCaption || ''}
            onChange={(value) => commit((n) => (n.sections[activeSection].featureCaption = value))}
          />
        )}
        {section.closingCaption !== undefined && (
          <TextArea
            label="Closing caption"
            value={section.closingCaption || ''}
            onChange={(value) => commit((n) => (n.sections[activeSection].closingCaption = value))}
          />
        )}
      </EditorGroup>
      <EditorGroup title="Quotes">
        {newsletter.quotes.map((quote, index) => (
          <div className="mini-block" key={index}>
            <TextArea label={`Quote ${index + 1}`} value={quote.text} onChange={(value) => commit((n) => (n.quotes[index].text = value))} />
            <TextInput label="Attribution" value={quote.by} onChange={(value) => commit((n) => (n.quotes[index].by = value))} />
          </div>
        ))}
      </EditorGroup>
      <EditorGroup title="Closing">
        <TextInput label="Note kicker" value={newsletter.closing.noteKicker} onChange={(value) => commit((n) => (n.closing.noteKicker = value))} />
        <TextArea label="Note" value={newsletter.closing.note} onChange={(value) => commit((n) => (n.closing.note = value))} />
        <TextArea label="Final lede" value={newsletter.closing.lede} onChange={(value) => commit((n) => (n.closing.lede = value))} />
        <TextInput label="Signature" value={newsletter.closing.name} onChange={(value) => commit((n) => (n.closing.name = value))} />
      </EditorGroup>
    </div>
  );
}

function DesignEditor({ newsletter, commit, themeMode, setThemeMode }) {
  return (
    <div className="editor-scroll">
      <EditorGroup title="Builder Theme">
        <div className="choice-row">
          <button className={themeMode === 'warm' ? 'choice active' : 'choice'} onClick={() => setThemeMode('warm')}>
            <Sun size={17} />
            <span>Warm</span>
          </button>
          <button className={themeMode === 'focus' ? 'choice active' : 'choice'} onClick={() => setThemeMode('focus')}>
            <Moon size={17} />
            <span>Focus</span>
          </button>
        </div>
      </EditorGroup>
      <EditorGroup title="Community Gallery">
        <TextInput label="Thank-you kicker" value={newsletter.thanks.kicker} onChange={(value) => commit((n) => (n.thanks.kicker = value))} />
        <TextInput label="Thank-you title" value={newsletter.thanks.title} onChange={(value) => commit((n) => (n.thanks.title = value))} />
        <TextArea label="Thank-you body" value={newsletter.thanks.body} onChange={(value) => commit((n) => (n.thanks.body = value))} />
        <GalleryEditor label="Gallery" images={newsletter.thanks.gallery} onChange={(images) => commit((n) => (n.thanks.gallery = images))} />
      </EditorGroup>
      <EditorGroup title="Calls To Action">
        {newsletter.ctas.map((cta, index) => (
          <div className="mini-block" key={index}>
            <TextInput label={`CTA ${index + 1} kicker`} value={cta.kicker} onChange={(value) => commit((n) => (n.ctas[index].kicker = value))} />
            <TextInput label="Title" value={cta.title} onChange={(value) => commit((n) => (n.ctas[index].title = value))} />
            <TextArea label="Body" value={cta.body} onChange={(value) => commit((n) => (n.ctas[index].body = value))} />
            <TextInput label="Button label" value={cta.label} onChange={(value) => commit((n) => (n.ctas[index].label = value))} />
            <TextInput label="URL" value={cta.url} onChange={(value) => commit((n) => (n.ctas[index].url = value))} />
            <SelectInput
              label="Style"
              value={cta.style}
              onChange={(value) => commit((n) => (n.ctas[index].style = value))}
              options={[
                { value: 'feature', label: 'Feature' },
                { value: 'dark', label: 'Dark button' },
                { value: 'ghost', label: 'Outline button' },
              ]}
            />
            {cta.dates && (
              <TextArea
                label="Dates"
                value={cta.dates.join('\n')}
                onChange={(value) => commit((n) => (n.ctas[index].dates = lines(value)))}
              />
            )}
          </div>
        ))}
      </EditorGroup>
      <EditorGroup title="Footer">
        <TextInput label="Tags" value={newsletter.footer.tags} onChange={(value) => commit((n) => (n.footer.tags = value))} />
        <TextArea label="Address" value={newsletter.footer.address} onChange={(value) => commit((n) => (n.footer.address = value))} />
      </EditorGroup>
    </div>
  );
}

function ExportPanel({ newsletter, generatedHtml, copyHtml, copied, exportHtml, exportJson, importRef, importJson }) {
  return (
    <div className="editor-scroll">
      <EditorGroup title="Publish">
        <div className="export-actions">
          <button className="command primary" onClick={exportHtml}>
            <FileCode2 size={16} />
            Download HTML
          </button>
          <button className="command ghost" onClick={copyHtml}>
            {copied ? <Check size={16} /> : <Clipboard size={16} />}
            {copied ? 'Copied' : 'Copy HTML'}
          </button>
          <button className="command ghost" onClick={exportJson}>
            <Save size={16} />
            Save JSON
          </button>
          <button className="command ghost" onClick={() => importRef.current?.click()}>
            <ArrowDownToLine size={16} />
            Import JSON
          </button>
          <input ref={importRef} type="file" accept="application/json" onChange={importJson} hidden />
        </div>
      </EditorGroup>
      <EditorGroup title="Meta">
        <ReadOnly label="Title" value={newsletter.meta.title} />
        <ReadOnly label="Description" value={newsletter.meta.description} />
        <ReadOnly label="HTML size" value={`${Math.round(generatedHtml.length / 1024)} KB`} />
      </EditorGroup>
      <EditorGroup title="HTML">
        <textarea className="code-view" readOnly value={generatedHtml} />
      </EditorGroup>
    </div>
  );
}

function EditorGroup({ title, children }) {
  return (
    <section className="editor-group">
      <h2>{title}</h2>
      <div className="field-stack">{children}</div>
    </section>
  );
}

function TextInput({ label, value, onChange }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function TextArea({ label, value, onChange }) {
  return (
    <label className="field">
      <span>{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function SelectInput({ label, value, onChange, options }) {
  return (
    <label className="field select-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown size={16} />
    </label>
  );
}

function ReadOnly({ label, value }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input value={value} readOnly />
    </label>
  );
}

function ImageInput({ label, image, onChange }) {
  const fileRef = useRef(null);
  const upload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange({ ...image, src: String(reader.result) });
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  return (
    <div className="image-field">
      <div className="image-field-head">
        <span>{label}</span>
        <button type="button" onClick={() => fileRef.current?.click()} title="Upload image">
          <ImagePlus size={15} />
        </button>
      </div>
      <div className="image-preview-row">
        <img src={image.src} alt="" />
        <div>
          <input value={image.src} onChange={(event) => onChange({ ...image, src: event.target.value })} />
          <input value={image.alt} onChange={(event) => onChange({ ...image, alt: event.target.value })} />
        </div>
      </div>
      <input ref={fileRef} type="file" accept="image/*" onChange={upload} hidden />
    </div>
  );
}

function GalleryEditor({ label, images, onChange }) {
  const addImage = () => onChange([...images, image('hero-celebrate.jpg', 'New gallery image')]);
  return (
    <div className="gallery-editor">
      <div className="image-field-head">
        <span>{label}</span>
        <button type="button" onClick={addImage} title="Add image">
          <ImagePlus size={15} />
        </button>
      </div>
      <div className="gallery-list">
        {images.map((img, index) => (
          <div className="gallery-item" key={`${img.src}-${index}`}>
            <ImageInput label={`Image ${index + 1}`} image={img} onChange={(next) => onChange(images.map((item, itemIndex) => (itemIndex === index ? next : item)))} />
            <button className="remove-image" onClick={() => onChange(images.filter((_, itemIndex) => itemIndex !== index))}>
              <Trash2 size={14} />
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function IconButton({ children, title, onClick, disabled, active }) {
  return (
    <button className={active ? 'icon-btn active' : 'icon-btn'} title={title} aria-label={title} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

function NewsletterPreview({ newsletter }) {
  return (
    <article className="newsletter-wrap">
      <div className="nl-masthead">
        <div className="nl-brand">
          <div className="nl-brand-mark">{renderBrand(newsletter.masthead.brand)}</div>
          <div className="nl-brand-sub">{newsletter.masthead.brandSub}</div>
        </div>
        <div className="nl-issue">
          {newsletter.masthead.issue}
          <br />
          {newsletter.masthead.issueDetail}
        </div>
      </div>

      <header className="nl-hero">
        <div className="nl-frame">
          <img src={newsletter.hero.image.src} alt={newsletter.hero.image.alt} />
        </div>
        <div className="nl-veil" />
        <div className="nl-top-kicker">
          <span className="nl-dot" />
          {newsletter.hero.topKicker}
        </div>
        <div className="nl-headline">
          <p>{newsletter.hero.eyebrow}</p>
          <h1>{highlightText(newsletter.hero.title, newsletter.hero.highlight)}</h1>
        </div>
      </header>

      <div className="nl-expect">
        <p>{newsletter.expect.lead}</p>
        <div className="nl-stack">
          {newsletter.expect.lines.map((line, index) => (
            <div className="nl-e-line" key={index}>
              <span>Expect</span>
              <strong>{line}</strong>
            </div>
          ))}
        </div>
      </div>

      <section className="nl-section nl-letter">
        <p className="nl-greet">{newsletter.letter.greeting}</p>
        <p className="nl-lede">{newsletter.letter.lede}</p>
        <p>{newsletter.letter.body}</p>
        <div className="nl-verbs">
          {newsletter.letter.chips.map((chip, index) => (
            <span key={index}>{chip}</span>
          ))}
        </div>
      </section>

      <Band value={newsletter.stat.value} label={newsletter.stat.label} />

      {newsletter.sections.map((section, index) => (
        <React.Fragment key={`${section.number}-${section.kicker}`}>
          <StorySection section={section} />
          {newsletter.quotes
            .filter((quote) => quote.afterSection === index)
            .map((quote, quoteIndex) => (
              <PullQuote key={quoteIndex} quote={quote} />
            ))}
        </React.Fragment>
      ))}

      <Band value={newsletter.thanks.title} label={newsletter.thanks.kicker} body={newsletter.thanks.body} compact />

      <section className="nl-section nl-gallery-strip">
        <div className="nl-grid nl-g3">
          {newsletter.thanks.gallery.map((img, index) => (
            <Figure img={img} key={index} ratio="sq" />
          ))}
        </div>
      </section>

      <section className="nl-section nl-cta-wrap">
        <p className="nl-kicker">
          <span>→</span> Take your next step
        </p>
        {newsletter.ctas.map((cta, index) => (
          <CtaCard cta={cta} key={index} />
        ))}
      </section>

      <div className="nl-rule" />

      <section className="nl-section nl-closing">
        <div className="nl-note">
          <p>{newsletter.closing.noteKicker}</p>
          <div>{newsletter.closing.note}</div>
        </div>
        <p className="nl-lede">{newsletter.closing.lede}</p>
        <p className="nl-signoff">{newsletter.closing.signoff}</p>
        <div className="nl-sig-name">{newsletter.closing.name}</div>
        <div className="nl-sig-role">{newsletter.closing.role}</div>
      </section>

      <footer className="nl-footer">
        <div className="nl-fmark">{renderBrand(newsletter.masthead.brand)}</div>
        <div className="nl-tags">{newsletter.footer.tags}</div>
        <div className="nl-small">{newsletter.footer.address}</div>
      </footer>
    </article>
  );
}

function StorySection({ section }) {
  const className = ['nl-section'];
  if (section.tint === true) className.push('nl-tint');
  if (section.tint === 'students') className.push('nl-students');

  return (
    <section className={className.join(' ')}>
      <p className="nl-kicker">
        <span>{section.number}</span> {section.kicker}
      </p>
      <h2>{highlightText(section.title, section.highlight)}</h2>
      {section.wordStack && (
        <div className="nl-word-stack">
          {section.wordStack.map((word, index) => (
            <span key={index}>{word}</span>
          ))}
        </div>
      )}
      {section.body && <p className={section.wordStack ? 'nl-muted' : ''}>{section.body}</p>}
      {section.heroImage && <Figure img={section.heroImage} caption={section.heroCaption} ratio="wide" className="nl-mt" />}
      {section.subhead && (
        <div className="nl-subhead">
          <p>{section.subhead}</p>
          <div>{section.subcopy}</div>
        </div>
      )}
      {!!section.gallery?.length && (
        <div className={`nl-grid ${section.gallery.length > 2 ? 'nl-g3' : 'nl-g2'} nl-mt`}>
          {section.gallery.map((img, index) => (
            <Figure img={img} key={index} ratio="tall" />
          ))}
        </div>
      )}
      {section.featureImage && <Figure img={section.featureImage} caption={section.featureCaption} ratio="feature" className="nl-feature-image" />}
      {section.closingCaption && <p className="nl-caption standalone">{section.closingCaption}</p>}
    </section>
  );
}

function Figure({ img, caption, ratio = 'wide', className = '' }) {
  return (
    <figure className={className}>
      <div className={`nl-photo ratio-${ratio}`}>
        <img src={img.src} alt={img.alt} />
      </div>
      {caption && <figcaption className="nl-caption">{caption}</figcaption>}
    </figure>
  );
}

function PullQuote({ quote }) {
  return (
    <div className="nl-pull">
      <div>“</div>
      <blockquote>{quote.text}</blockquote>
      {quote.by && <p>{quote.by}</p>}
    </div>
  );
}

function Band({ value, label, body, compact }) {
  return (
    <div className="nl-band">
      <div className={compact ? 'nl-band-value compact' : 'nl-band-value'}>{value}</div>
      <div className="nl-band-label">{label}</div>
      {body && <p>{body}</p>}
    </div>
  );
}

function CtaCard({ cta }) {
  const isFeature = cta.style === 'feature';
  return (
    <div className={isFeature ? 'nl-cta feature' : 'nl-cta'}>
      <p>{cta.kicker}</p>
      <h3>{cta.title}</h3>
      <div>{cta.body}</div>
      <a className={`nl-btn ${cta.style === 'dark' ? 'dark' : cta.style === 'ghost' ? 'ghost' : 'primary'}`} href={cta.url}>
        {cta.label} <span>→</span>
      </a>
      {cta.dates && (
        <>
          <div className="nl-dates-label">{cta.datesLabel}</div>
          <div className="nl-date-chips">
            {cta.dates.map((date, index) => (
              <span key={index} className={date.toLowerCase().includes('full') ? 'full' : ''}>
                {date}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function renderBrand(brand) {
  const pIndex = brand.toUpperCase().lastIndexOf('P');
  if (pIndex < 0) return brand;
  return (
    <>
      {brand.slice(0, pIndex)}
      <span>{brand.slice(pIndex)}</span>
    </>
  );
}

function highlightText(text, highlight) {
  if (!highlight || !text.includes(highlight)) return text;
  const [before, after] = text.split(highlight);
  return (
    <>
      {before}
      <em>{highlight}</em>
      {after}
    </>
  );
}

function lines(value) {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function nl2br(value = '') {
  return escapeHtml(value).replaceAll('\n', '<br/>');
}

function highlightedHtml(text, highlight) {
  if (!highlight || !text.includes(highlight)) return escapeHtml(text);
  return escapeHtml(text).replace(escapeHtml(highlight), `<em>${escapeHtml(highlight)}</em>`);
}

function buildExportHtml(newsletter) {
  const sectionHtml = newsletter.sections
    .map((section, index) => {
      const sectionClass = section.tint === true ? ' class="tint"' : section.tint === 'students' ? ' class="students"' : '';
      const hero = section.heroImage
        ? figureHtml(section.heroImage, section.heroCaption, 'wide mt')
        : '';
      const subhead = section.subhead
        ? `<div class="subhead"><p>${escapeHtml(section.subhead)}</p><div>${escapeHtml(section.subcopy)}</div></div>`
        : '';
      const words = section.wordStack
        ? `<div class="four">${section.wordStack.map((word) => `<span>${escapeHtml(word)}</span>`).join('')}</div>`
        : '';
      const gallery = section.gallery?.length
        ? `<div class="grid ${section.gallery.length > 2 ? 'g-3' : 'g-2'} mt">${section.gallery.map((img) => figureHtml(img, '', 'tall')).join('')}</div>`
        : '';
      const feature = section.featureImage ? figureHtml(section.featureImage, section.featureCaption, 'feature feature-image') : '';
      const closingCaption = section.closingCaption ? `<p class="caption standalone">${escapeHtml(section.closingCaption)}</p>` : '';
      const quotes = newsletter.quotes
        .filter((quote) => quote.afterSection === index)
        .map(
          (quote) =>
            `<div class="pull"><div class="mark">“</div><blockquote>${escapeHtml(quote.text)}</blockquote>${quote.by ? `<p>${escapeHtml(quote.by)}</p>` : ''}</div>`,
        )
        .join('');

      return `<section${sectionClass}>
  <p class="kicker"><span>${escapeHtml(section.number)}</span>${escapeHtml(section.kicker)}</p>
  <h2>${highlightedHtml(section.title, section.highlight)}</h2>
  ${words}
  ${section.body ? `<p${section.wordStack ? ' class="muted"' : ''}>${escapeHtml(section.body)}</p>` : ''}
  ${hero}
  ${subhead}
  ${gallery}
  ${feature}
  ${closingCaption}
</section>${quotes}`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(newsletter.meta.title)}</title>
<meta name="description" content="${escapeHtml(newsletter.meta.description)}" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800;900&family=Newsreader:ital,opsz,wght@1,18,400;1,18,500&display=swap" rel="stylesheet" />
${exportCss()}
</head>
<body>
<div class="wrap">
  <div class="masthead">
    <div>
      <div class="brand-mark">${brandHtml(newsletter.masthead.brand)}</div>
      <div class="brand-sub">${escapeHtml(newsletter.masthead.brandSub)}</div>
    </div>
    <div class="issue">${escapeHtml(newsletter.masthead.issue)}<br/>${escapeHtml(newsletter.masthead.issueDetail)}</div>
  </div>
  <header class="hero">
    <div class="frame"><img src="${escapeHtml(newsletter.hero.image.src)}" alt="${escapeHtml(newsletter.hero.image.alt)}" /></div>
    <div class="veil"></div>
    <div class="top-kicker"><span></span>${escapeHtml(newsletter.hero.topKicker)}</div>
    <div class="headline"><p>${escapeHtml(newsletter.hero.eyebrow)}</p><h1>${highlightedHtml(newsletter.hero.title, newsletter.hero.highlight)}</h1></div>
  </header>
  <div class="expect">
    <p>${escapeHtml(newsletter.expect.lead)}</p>
    <div>${newsletter.expect.lines.map((line) => `<div><span>Expect</span><strong>${escapeHtml(line)}</strong></div>`).join('')}</div>
  </div>
  <section>
    <p class="greet">${escapeHtml(newsletter.letter.greeting)}</p>
    <p class="lede">${escapeHtml(newsletter.letter.lede)}</p>
    <p>${escapeHtml(newsletter.letter.body)}</p>
    <div class="verbs">${newsletter.letter.chips.map((chip) => `<span>${escapeHtml(chip)}</span>`).join('')}</div>
  </section>
  <div class="band"><div>${escapeHtml(newsletter.stat.value)}</div><p>${escapeHtml(newsletter.stat.label)}</p></div>
  ${sectionHtml}
  <div class="band thanks"><p>${escapeHtml(newsletter.thanks.kicker)}</p><div>${escapeHtml(newsletter.thanks.title)}</div><span>${escapeHtml(newsletter.thanks.body)}</span></div>
  <section class="gallery-strip"><div class="grid g-3">${newsletter.thanks.gallery.map((img) => figureHtml(img, '', 'sq')).join('')}</div></section>
  <section class="cta-wrap">
    <p class="kicker"><span>→</span>Take your next step</p>
    ${newsletter.ctas.map(ctaHtml).join('')}
  </section>
  <div class="rule"></div>
  <section class="closing">
    <div class="note"><p>${escapeHtml(newsletter.closing.noteKicker)}</p><div>${escapeHtml(newsletter.closing.note)}</div></div>
    <p class="lede">${escapeHtml(newsletter.closing.lede)}</p>
    <p class="signoff">${escapeHtml(newsletter.closing.signoff)}</p>
    <div class="sig-name">${escapeHtml(newsletter.closing.name)}</div>
    <div class="sig-role">${escapeHtml(newsletter.closing.role)}</div>
  </section>
  <footer>
    <div class="fmark">${brandHtml(newsletter.masthead.brand)}</div>
    <div class="tags">${escapeHtml(newsletter.footer.tags)}</div>
    <div class="small">${nl2br(newsletter.footer.address)}</div>
  </footer>
</div>
</body>
</html>`;
}

function brandHtml(brand) {
  const pIndex = brand.toUpperCase().lastIndexOf('P');
  if (pIndex < 0) return escapeHtml(brand);
  return `${escapeHtml(brand.slice(0, pIndex))}<span>${escapeHtml(brand.slice(pIndex))}</span>`;
}

function figureHtml(img, caption, ratioClasses) {
  return `<figure><div class="photo ${ratioClasses}"><img src="${escapeHtml(img.src)}" alt="${escapeHtml(img.alt)}" /></div>${caption ? `<figcaption class="caption">${escapeHtml(caption)}</figcaption>` : ''}</figure>`;
}

function ctaHtml(cta) {
  const btn = cta.style === 'dark' ? 'dark' : cta.style === 'ghost' ? 'ghost' : 'primary';
  const dates = cta.dates
    ? `<div class="dates">${escapeHtml(cta.datesLabel || '')}</div><div class="date-chips">${cta.dates
        .map((date) => `<span${date.toLowerCase().includes('full') ? ' class="full"' : ''}>${escapeHtml(date)}</span>`)
        .join('')}</div>`
    : '';
  return `<div class="cta ${cta.style === 'feature' ? 'feature' : ''}">
  <p>${escapeHtml(cta.kicker)}</p>
  <h3>${escapeHtml(cta.title)}</h3>
  <div>${escapeHtml(cta.body)}</div>
  <a class="btn ${btn}" href="${escapeHtml(cta.url)}">${escapeHtml(cta.label)} <span>→</span></a>
  ${dates}
</div>`;
}

function exportCss() {
  return `<style>
  :root{--ink:#1a1613;--ink-soft:#5a4f47;--paper:#faf4ea;--paper-2:#f1e6d4;--line:#e4d6c0;--orange:#f26a1b;--grad:linear-gradient(100deg,#f7a81c 0%,#f26a1b 42%,#e0218a 100%);--radius:16px;--font-display:'Archivo',system-ui,sans-serif;--font-quote:'Newsreader',Georgia,serif}*{box-sizing:border-box}html,body{margin:0;padding:0}body{background:#cdbfa9;font-family:var(--font-display);color:var(--ink);line-height:1.55;-webkit-font-smoothing:antialiased}.wrap{max-width:680px;margin:0 auto;background:var(--paper);box-shadow:0 30px 80px rgba(0,0,0,.28)}img{display:block;width:100%;height:100%;object-fit:cover}.masthead{background:var(--ink);color:var(--paper);display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 26px}.brand-mark,.fmark{font-weight:900;font-size:22px;letter-spacing:.06em;line-height:1}.brand-mark span,.fmark span{background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent}.brand-sub{font-size:9.5px;letter-spacing:.34em;text-transform:uppercase;color:#b8a89a;font-weight:600;margin-top:3px}.issue{text-align:right;font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:#b8a89a;font-weight:600;line-height:1.5}.hero{position:relative}.frame{aspect-ratio:680/520;background:var(--ink);overflow:hidden}.veil{position:absolute;inset:0;background:linear-gradient(180deg,rgba(20,16,12,.45),rgba(20,16,12,0) 28%,rgba(20,16,12,.85))}.top-kicker{position:absolute;top:20px;left:26px;right:26px;display:flex;align-items:center;gap:10px;color:white;font-size:11px;letter-spacing:.28em;text-transform:uppercase;font-weight:700}.top-kicker span{width:7px;height:7px;border-radius:50%;background:var(--orange)}.headline{position:absolute;left:26px;right:26px;bottom:24px;color:white}.headline p{font-family:var(--font-quote);font-style:italic;font-size:19px;color:#ffd9b8;margin:0 0 4px}.headline h1{font-size:58px;line-height:.92;letter-spacing:0;text-transform:uppercase;margin:0;font-weight:900}.headline em,h2 em,.expect strong,.four span:nth-child(2){font-style:normal;background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent}.expect{background:var(--ink);color:var(--paper);padding:34px 26px 38px}.expect>p{font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:#9c8e7f;font-weight:700;margin:0 0 16px}.expect div div{font-weight:900;text-transform:uppercase;font-size:46px;line-height:1;letter-spacing:0;display:flex;flex-wrap:wrap;gap:.28em}.expect span{color:#6f6357}.expect strong{font-weight:900}section{padding:40px 26px}.greet{font-family:var(--font-quote);font-style:italic;font-size:21px;margin:0 0 14px}.lede{font-size:18.5px;line-height:1.5;color:var(--ink)}p{margin:0 0 16px;font-size:16.5px;color:#2c2520}.verbs{display:flex;flex-wrap:wrap;gap:8px;margin:22px 0 4px}.verbs span{font-size:13px;font-weight:600;background:var(--paper-2);padding:7px 13px;border-radius:999px;border:1px solid var(--line)}.band{background:var(--grad);color:white;text-align:center;padding:30px 26px}.band div{font-weight:900;font-size:72px;line-height:.9;letter-spacing:0}.band p,.thanks p{font-size:13px;letter-spacing:.16em;text-transform:uppercase;font-weight:700;margin:8px 0 0;color:white}.thanks div{font-size:46px}.thanks span{display:block;max-width:42ch;margin:14px auto 0;font-size:14.5px;color:white}.kicker{display:flex;align-items:center;gap:10px;font-size:11px;letter-spacing:.26em;text-transform:uppercase;font-weight:700;color:var(--orange);margin:0 0 14px}.kicker span{font-weight:900;font-size:12px;background:var(--ink);color:var(--paper);width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;letter-spacing:0;flex:0 0 auto}h2{font-weight:800;font-size:38px;line-height:1.02;letter-spacing:0;margin:0 0 16px}.photo{overflow:hidden;border-radius:var(--radius);background:var(--paper-2)}.wide{aspect-ratio:3/2}.tall{aspect-ratio:3/4}.sq{aspect-ratio:1/1}.feature{aspect-ratio:4/5}.grid{display:grid;gap:10px}.g-2{grid-template-columns:1fr 1fr}.g-3{grid-template-columns:repeat(3,1fr)}.mt{margin-top:18px}.caption{font-size:12.5px;color:var(--ink-soft);margin-top:9px;line-height:1.45;display:flex;gap:8px}.caption:before{content:"";flex:0 0 auto;width:16px;height:2px;background:var(--orange);margin-top:8px;border-radius:2px}.standalone{margin-top:14px}.subhead{margin:30px 0 14px}.subhead p{font-size:11px;letter-spacing:.2em;text-transform:uppercase;font-weight:700;color:var(--orange);margin:0 0 5px}.subhead div{font-size:15px;color:#3a322b}.tint,.students{background:var(--paper-2)}.students{text-align:center}.students .kicker{justify-content:center}.four{display:flex;flex-direction:column;margin:6px 0 22px}.four span{font-weight:900;text-transform:uppercase;font-size:56px;line-height:.98;letter-spacing:0}.muted{color:var(--ink-soft);max-width:46ch;margin:0 auto 22px}.pull{background:var(--ink);color:var(--paper);padding:44px 30px}.pull .mark{font-weight:900;font-size:54px;line-height:.6;background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent}.pull blockquote{margin:6px 0 0;font-family:var(--font-quote);font-style:italic;font-size:30px;line-height:1.32;color:#f6ecdd}.pull p{font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:#9c8e7f;font-weight:700;margin-top:18px}.gallery-strip{padding-top:30px;padding-bottom:14px}.cta-wrap{padding-top:8px}.cta{border:1px solid var(--line);border-radius:var(--radius);padding:24px 22px;margin-bottom:14px;background:white}.cta.feature{background:var(--ink);border-color:var(--ink);color:var(--paper)}.cta p{font-size:10.5px;letter-spacing:.24em;text-transform:uppercase;font-weight:700;color:var(--ink-soft);margin:0 0 8px}.cta.feature p{color:#9c8e7f}.cta h3{font-weight:800;font-size:21px;letter-spacing:0;margin:0 0 8px;line-height:1.05;text-transform:uppercase}.cta div{font-size:14.5px;margin:0 0 16px;color:#2c2520}.cta.feature div{color:#d9cdbd}.btn{display:inline-flex;align-items:center;gap:10px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;font-size:14px;text-decoration:none;padding:14px 22px;border-radius:999px}.primary{background:var(--grad);color:white}.dark{background:var(--ink);color:var(--paper)}.ghost{background:transparent;color:var(--ink);border:1.5px solid var(--ink)}.dates{margin-top:14px!important;border-top:1px solid #3a322b;padding-top:14px;font-size:13px!important;color:var(--paper)!important;font-weight:700}.date-chips{display:flex;flex-wrap:wrap;gap:7px;margin-top:13px!important}.date-chips span{font-size:12.5px;font-weight:600;color:var(--paper);background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);padding:6px 12px;border-radius:999px}.date-chips span.full{opacity:.45}.rule{height:1px;background:var(--line);margin:0 26px}.closing{text-align:center;padding-bottom:30px}.note{background:var(--paper-2);border:1px solid var(--line);border-radius:var(--radius);padding:22px 24px;margin:0 auto 26px;max-width:46ch}.note p{font-size:10.5px;letter-spacing:.24em;text-transform:uppercase;font-weight:700;color:var(--orange);margin:0 0 10px}.note div{font-size:15px;color:#3a322b;line-height:1.55}.signoff{font-family:var(--font-quote);font-style:italic;color:var(--ink-soft);margin:0}.sig-name{font-weight:800;font-size:22px;margin-top:6px}.sig-role{font-size:12.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--ink-soft);font-weight:600;margin-top:4px}footer{background:var(--ink);color:#b8a89a;text-align:center;padding:32px 26px 40px}.tags{font-size:11px;letter-spacing:.2em;text-transform:uppercase;margin-top:12px;color:#8a7c6e}.small{font-size:11px;margin-top:16px;color:#6f6357;line-height:1.6}@media(max-width:480px){section{padding:34px 20px}.masthead{padding:14px 20px}.headline,.top-kicker{left:20px;right:20px}.expect,.pull{padding-left:20px;padding-right:20px}.headline h1{font-size:39px}.expect div div{font-size:31px}.band div{font-size:52px}.thanks div{font-size:34px}h2{font-size:29px}.four span{font-size:36px}.pull blockquote{font-size:24px}}
</style>`;
}

createRoot(document.getElementById('root')).render(<App />);

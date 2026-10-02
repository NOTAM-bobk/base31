// Long-form copy for `/tools/<slug>` — the apex landing page for each entry in
// the directory. These pages exist to rank for what people actually search for
// ("free qr code generator"), so each one leads with what the tool does, then
// how to use it, then the questions worth answering. The copy is written fresh
// here rather than copied from the tool's own subdomain, so the two pages do not
// compete for the same query.
//
// Kept in code rather than JSON so it is reviewed in pull requests, the way
// lib/blogs.ts keeps its editorial posts. One entry per site with
// `"show": true` in config/sites.json; `npm run validate:content` fails if a
// listed site has no page or an entry is missing its copy.

import sitesConfig from "@/config/sites.json";

export type ToolFeature = { title: string; body: string };
export type ToolFaq = { question: string; answer: string };

export type ToolPage = {
  /** The h1, written as the page's promise rather than the tool's name. */
  headline: string;
  /** Meta description and the blurb on /tools. Around 150 characters. */
  metaDescription: string;
  /** One line under the headline and on the /tools index. */
  summary: string;
  /** Opening paragraphs, plain text. */
  intro: string[];
  /** What it does, rendered as a small grid. */
  features: ToolFeature[];
  /** How to use it, in order. */
  steps: string[];
  /** Questions people ask, rendered as <details> plus FAQPage schema. */
  faqs: ToolFaq[];
  /** Slugs to link instead of the tag-derived suggestions, when order matters. */
  related?: string[];
};

export const toolPages: Record<string, ToolPage> = {
  appscreenshot: {
    headline: "Screenshot any website, at full quality, for free",
    metaDescription:
      "Capture a full-quality screenshot of any website from its URL. Free, no sign-up and no watermark — paste a link and download the image.",
    summary: "Paste any URL and download a clean, full-quality screenshot of the page.",
    intro: [
      "App Screenshot turns a web address into an image. Paste a link and you get back a screenshot you can drop into a product page, a portfolio, a slide deck, or a bug report.",
      "There is no account to create and no watermark stamped over the result. It runs in the browser, so there is nothing to install and it works the same on a phone.",
    ],
    features: [
      { title: "Any public URL", body: "Point it at a page on the open web and it captures what a visitor would see, rather than a cropped thumbnail." },
      { title: "No sign-up, no watermark", body: "The image comes back clean. Nothing is overlaid on it and no account is required." },
      { title: "Download-ready", body: "Save the result straight from the browser and use it wherever you need a picture of a page." },
      { title: "Nothing to install", body: "It runs in the browser, so there is no extension or desktop app to keep updated." },
    ],
    steps: [
      "Open the tool and paste the full address of the page you want, including https://.",
      "Start the capture and let the page finish rendering.",
      "Download the image, or capture another URL without reloading.",
    ],
    faqs: [
      { question: "Is App Screenshot free?", answer: "Yes. There is no charge, no account, and no watermark on the saved image." },
      { question: "Can it capture pages that need a login?", answer: "It captures what is publicly visible at the URL you give it, so pages behind a sign-in will not render their private content." },
      { question: "Does it work on a phone?", answer: "Yes — it runs in the browser, so desktop and mobile behave the same way." },
    ],
  },

  donation: {
    headline: "Support base31.org",
    metaDescription:
      "Support base31.org and help keep a small, independent collection of useful tools, creative projects, and open-web experiments online.",
    summary: "Help cover what it costs to keep the directory and its tools running.",
    intro: [
      "base31.org is a small, independent project: a set of free tools and experiments published on the open web with no accounts and no paywalls in the way.",
      "Support pays for hosting, domains, and the time it takes to keep each tool working. Every contribution goes into the same pot of running costs.",
    ],
    features: [
      { title: "Hosting and domains", body: "Every tool in the directory has to run somewhere, and its subdomain has to stay pointed at it." },
      { title: "Keeping tools working", body: "Third parties change their APIs and their terms; support is what buys the time to fix what breaks." },
      { title: "New experiments", body: "Ideas for the directory get built when there is time and budget to build them." },
      { title: "No paid tiers", body: "Nothing in the directory is gated behind a contribution. The tools stay open to everyone." },
    ],
    steps: [
      "Open the donation page and choose an amount.",
      "Complete the payment with the method you prefer.",
      "Want your name on the board? Leave a note with the contribution.",
    ],
    faqs: [
      { question: "Do I have to donate to use the tools?", answer: "No. Every tool in the directory is free to use, and nothing is locked behind a contribution." },
      { question: "What does the money pay for?", answer: "Hosting, domain registration, the third-party services some tools depend on, and the time spent maintaining them." },
      { question: "Can I help without paying?", answer: "Yes. Sharing a tool you found useful, or leaving a review, helps just as much as money does." },
    ],
  },

  share: {
    headline: "Share a file with a link, without an account",
    metaDescription:
      "Upload a file and get a shareable link in seconds. Free file sharing with no account, expiring links, QR codes, and support for large files.",
    summary: "Upload a file, get a link, send it — no account needed on either end.",
    intro: [
      "Relay takes a file and gives you back a link you can paste anywhere. It is the shortest path from \"I have this file\" to \"here, take it\".",
      "There is no account to create, and the person receiving it does not need one either. They open the link and get the file.",
    ],
    features: [
      { title: "Links, not attachments", body: "The upload happens once, and the link can be shared as many times as you like." },
      { title: "Expiring links", body: "Set a link to expire, so it stops working after the window you choose." },
      { title: "QR codes", body: "Send a file to a phone in the room without anyone typing a URL by hand." },
      { title: "Large files", body: "Built for the files that are too big for an email attachment." },
    ],
    steps: [
      "Open the tool and choose the file you want to send.",
      "Let the upload finish, then copy the link it returns.",
      "Share the link, optionally with an expiry set so it cleans up after itself.",
    ],
    faqs: [
      { question: "Do I need an account to send a file?", answer: "No, and neither does the recipient. Open the tool, pick a file, and share the link it gives you." },
      { question: "How do I make a link stop working?", answer: "Set an expiry when you share it. That is the most reliable way to take a file out of circulation later." },
      { question: "Is there a size limit?", answer: "It is built for the files that are too big to email. Very large uploads depend on your connection, so give them time to finish." },
    ],
  },

  compmails: {
    headline: "Free temp mail that opens the moment you need it",
    metaDescription:
      "Create free temp mail with no sign up: a fast, guaranteed disposable inbox that opens in one click and reads verification links instantly.",
    summary: "A disposable inbox in one click — free, no sign up, no password to invent.",
    intro: [
      "A temp mail address is the address you hand out when you do not want to hand out yours. CompMails issues one the second the page opens, so there is no form to fill in, no confirmation mail to click, and nothing to remember afterwards.",
      "It is built for the small jobs — a download gate, a trial that insists on an email, a one-off verification link — and for testing your own signup flow end to end without spending a real address on it.",
    ],
    features: [
      { title: "Instant, and no sign up", body: "The address exists before you finish reading the page, and it is kept in your own browser so a reload brings it back." },
      { title: "Live inbox", body: "The page checks for new mail on its own and pauses while the tab is in the background, so a waiting code appears as soon as you look." },
      { title: "Search, unread filter, reader", body: "Find a message by sender, subject or text, filter to unread only, then read it in a sandboxed frame with the raw headers a click away." },
      { title: "Attachments and exports", body: "Download an attachment straight from the reader, or save the whole message as an .eml file to keep or forward." },
    ],
    steps: [
      "Open CompMails and copy the address it creates for you, or show it as a QR code and scan it with a phone.",
      "Paste the address into the form, trial or download gate you are working with and send the mail.",
      "Read it on the page — follow the link or download the attachment — then start a fresh inbox whenever you are done.",
    ],
    faqs: [
      { question: "Do I need to sign up for a temp mail address?", answer: "No. There is no account, no password and no confirmation step: the inbox is created for you and kept in this browser, and a fresh one is always one click away." },
      { question: "Can I keep an address for later?", answer: "Yes — choose your own name, domain and password, and the address can be reopened from the inboxes kept in your browser. Random addresses can be saved the same way." },
      { question: "What should I not use it for?", answer: "Anything you would be upset to lose. Disposable inboxes expire after a few days, so password resets and account recovery do not belong here — and anyone who knows the address can read it." },
    ],
  },

  dailywordel: {
    headline: "A daily word game you can finish in five minutes",
    metaDescription:
      "Guess the word of the day in six tries. A free daily word puzzle that plays in the browser, with no account to create and no streak to lose.",
    summary: "One word puzzle a day, six guesses, no account.",
    intro: [
      "Daily Wordle gives you a single word to guess, with the familiar colour-coded feedback telling you how close each attempt was.",
      "It is the same puzzle for everyone, once a day. There is no account, no streak to break, and no notification nagging you to come back.",
    ],
    features: [
      { title: "One puzzle a day", body: "A fresh word arrives each day, so the game stays a small daily ritual rather than a grind." },
      { title: "Familiar rules", body: "Six guesses, colour-coded tiles, and a keyboard that shows which letters you have already ruled out." },
      { title: "Built for a phone", body: "The board is sized for a thumb, so it plays fine on a commute." },
      { title: "No account", body: "Nothing to sign up for, and nothing lost if you skip a day." },
    ],
    steps: [
      "Open the page for today's word.",
      "Type a guess and submit it — tiles turn green for a correct letter in the right place and yellow for a correct letter in the wrong one.",
      "Keep going until you solve it or run out of tries.",
    ],
    faqs: [
      { question: "Is there a new word every day?", answer: "Yes. Today's puzzle is the same for everyone, and tomorrow brings a fresh word." },
      { question: "Do I need an account or an app?", answer: "No. It runs in the browser with no sign-up and nothing to install." },
      { question: "Does it work on mobile?", answer: "Yes — the board is laid out for a phone as well as a desktop." },
    ],
  },

  iframetester: {
    headline: "Find out whether a page can be embedded in an iframe",
    metaDescription:
      "Test whether any URL is allowed to load inside an iframe. See the result immediately and work out why an embed shows up blank.",
    summary: "Check whether a page can be embedded — and see what blocks it when it cannot.",
    intro: [
      "An embed that silently shows nothing is usually a header problem, not a bug in your markup. Iframe Tester loads the URL you give it and shows you whether the page actually renders.",
      "It is the fastest way to answer \"can I put this in an iframe?\" before you build an integration around the assumption that you can.",
    ],
    features: [
      { title: "Paste a URL, see the result", body: "The test runs immediately and tells you whether the frame loaded or stayed blank." },
      { title: "Catches blocked embeds", body: "Most refusals come from X-Frame-Options or a Content-Security-Policy frame-ancestors rule. The tester shows the failure instead of leaving you guessing." },
      { title: "No setup", body: "Nothing to install and no account, so it fits into a debugging loop." },
      { title: "Useful before you build", body: "Check third-party embeds, dashboards, and hosted forms before wiring them into your own page." },
    ],
    steps: [
      "Paste the URL you want to embed.",
      "Run the test and watch whether the frame renders.",
      "If it stays blank, the block is on their side: look for frame-ancestors or X-Frame-Options in their response headers.",
    ],
    faqs: [
      { question: "Why does my iframe show a blank page?", answer: "The site being embedded is usually sending X-Frame-Options or a Content-Security-Policy that forbids framing. That is set by the site you are embedding, not by your page, so the fix has to happen on their side." },
      { question: "Does the tester change anything on the target site?", answer: "No. It only requests the URL the way your browser would when embedding it." },
      { question: "Is it free?", answer: "Yes, and there is no sign-up." },
    ],
  },

  isitdown: {
    headline: "Check whether a website is down for everyone or just for you",
    metaDescription:
      "Check whether a website or server is down right now. Enter any URL for a live reachability test with HTTP status, response time, IP address, and DNS records.",
    summary: "A live reachability test with status code, latency, IP address, and DNS.",
    intro: [
      "Is It Down runs a fresh request against the address you give it and reports what came back: whether the site answered, the HTTP status, how long it took, the address it resolved to, and the relevant DNS records.",
      "That combination is usually enough to separate three very different problems — a server that is genuinely offline, a site that is blocking you, and a DNS failure on your own connection.",
    ],
    features: [
      { title: "Live HTTP check", body: "The test runs when you ask for it rather than reading a stale cache, so the result reflects the last few seconds." },
      { title: "Status and latency", body: "The response code and the time it took together tell you whether a site is down or merely slow." },
      { title: "DNS records", body: "A and AAAA lookups show whether the name resolves at all before you start blaming the server." },
      { title: "IP address", body: "Useful when two people in different places are getting different answers." },
    ],
    steps: [
      "Enter the domain or full URL you want to check.",
      "Run the test and read the status, the timing, and the resolution results.",
      "A name that resolves but never answers points at the server; a name that does not resolve at all points at DNS.",
    ],
    faqs: [
      { question: "How do I know if a site is down for everyone?", answer: "Run the check here and then from a different network — a phone on mobile data is the quickest second opinion. If both fail, the problem is the site rather than your connection." },
      { question: "What does a DNS failure mean?", answer: "The name never resolved to an address, so your browser did not get as far as contacting a server. That is usually a DNS or domain problem rather than an outage." },
      { question: "Does it work for any URL?", answer: "It works for publicly reachable addresses. Sites that deliberately block automated requests can report a blocked response even while they are up and serving real visitors." },
    ],
  },

  isittaken: {
    headline: "Find out whether a domain name is already taken",
    metaDescription:
      "Check whether a domain name is available or already registered. See registration insights, live DNS, availability across popular extensions, and instant name suggestions.",
    summary: "Check a name, see whether it is in use, and get alternatives that are free.",
    intro: [
      "Is It Taken looks up the domain you are considering and tells you whether it is registered, what it resolves to, and which similar names are still available.",
      "It checks the common endings at once, so you are not repeating the same search five times while you are still deciding what to call something.",
    ],
    features: [
      { title: "Availability in one pass", body: "Check the name you want and see how each popular extension looks in the same result." },
      { title: "Registration insights", body: "Registration data helps you tell a domain that is genuinely in use from one that is parked." },
      { title: "Live DNS", body: "Resolution results confirm what the registration data suggests, rather than leaving you to trust one source." },
      { title: "Instant alternatives", body: "When the obvious name is gone, the tool suggests nearby ones that are not." },
    ],
    steps: [
      "Type the name you are considering, with or without an extension.",
      "Read the availability result, then look at the DNS and registration details for the ones that are taken.",
      "Take a suggestion, or adjust the name and check again.",
    ],
    faqs: [
      { question: "Is a domain showing as available really free to register?", answer: "Treat it as a strong signal rather than a guarantee. Registrars can hold names in states that look free from the outside, so confirm at a registrar before you rely on the result." },
      { question: "Why do some registered domains show no website?", answer: "A registered name can be parked, held for resale, or simply not pointed at anything yet. Registration tells you the name is taken, not that a business is running on it." },
      { question: "Does checking a domain register it?", answer: "No. A lookup only reads public registration and DNS data, so nothing is reserved by searching." },
    ],
  },

  githubexplorer: {
    headline: "Browse any GitHub repository, then draft the docs with AI",
    metaDescription:
      "Explore any GitHub repository's files and folders, read the code, browse a user's repositories, and generate a README, docs, or next steps with AI.",
    summary: "Read any public repo in the browser, and get AI help writing the documentation.",
    intro: [
      "GitHub Explorer is a lighter way to read a repository than cloning it. Paste an owner and repository, walk the file tree, and open files as you go.",
      "When you have finished reading, the AI side will draft a README, documentation, or a list of next steps based on what is actually in the project.",
    ],
    features: [
      { title: "Read any public repository", body: "Move through folders and files without anyone setting up a local checkout first." },
      { title: "Explore a user", body: "Look at everything an account has published, which is useful when you are evaluating someone's work." },
      { title: "AI drafting", body: "Generate a README, documentation, or next steps from the repository's own contents." },
      { title: "Nothing to install", body: "It runs in the browser against GitHub's public API, so no token or CLI is involved." },
    ],
    steps: [
      "Paste a repository as owner/repo and open it.",
      "Browse the file tree and read the files you need.",
      "Use the AI actions to draft a README, documentation, or next steps, then edit the result into your own words.",
    ],
    faqs: [
      { question: "Can it read private repositories?", answer: "No. It reads GitHub's public API without asking for a token, so only public repositories are available." },
      { question: "Is the AI writing based on the real code?", answer: "The draft is generated from the files in the repository you are looking at, so it reflects the project rather than a generic template. Treat it as a first pass to edit." },
      { question: "Does it work for any language?", answer: "Yes. Files are read as text, so the repository's language does not matter." },
    ],
  },

  qrgenerator: {
    headline: "Free QR code generator with colours, styles, and a logo",
    metaDescription:
      "Create a free QR code for a link, text, Wi-Fi, contacts, email, or SMS. Custom colours, rounded styles, and a centre logo, with PNG and SVG download.",
    summary: "Make a QR code for links, Wi-Fi, contacts, and messages — then download PNG or SVG.",
    intro: [
      "The QR Code Generator covers the codes people actually need: a web link, plain text, a Wi-Fi network guests can join, a contact card, an email, an SMS, or a phone number.",
      "You can change the colours, pick a rounded style, and drop a logo into the middle, then download the result as a PNG for a screen or an SVG that stays sharp wherever it is resized.",
    ],
    features: [
      { title: "The payloads people use", body: "Wi-Fi, contact cards, email, SMS, and phone numbers are set up as forms, so you do not have to remember the encoding rules." },
      { title: "Custom colours and styles", body: "Match the code to your brand, with rounded modules if you want a softer look than the default grid." },
      { title: "Centre logo", body: "Put your mark in the middle — the error-correction level keeps the code scannable around it." },
      { title: "PNG and SVG", body: "Raster for a quick paste into a document, vector for anything that gets printed or resized." },
    ],
    steps: [
      "Choose the kind of code you need and fill in the fields.",
      "Adjust the colours and style, and add a logo if you want one.",
      "Scan the preview with your phone to confirm it works, then download the PNG or SVG.",
    ],
    faqs: [
      { question: "Do the QR codes expire?", answer: "No. The code encodes your content directly rather than pointing at a redirect, so it keeps working for as long as the destination does." },
      { question: "Will a logo in the middle stop it scanning?", answer: "Not if the logo stays inside the centre and the code keeps its error-correction headroom. Always scan the preview before you print." },
      { question: "Which download format should I use?", answer: "Use PNG for a screen or a quick paste, and SVG for print or anywhere the image might be scaled up." },
      { question: "Does it cost anything?", answer: "No. There is no charge and no account to create." },
    ],
  },

  passwordgen: {
    headline: "Strong password generator with a vault only your passphrase opens",
    metaDescription:
      "Generate strong random passwords and memorable passphrases in your browser, read their strength, and keep them in a vault encrypted with your own master passphrase.",
    summary: "Random passwords and passphrases, plus a vault encrypted in your browser.",
    intro: [
      "The Password Generator creates random passwords and readable passphrases, shows how much entropy each one carries, and can skip the characters that cause typos when you have to type them by hand.",
      "It also keeps a small vault. Everything in it is encrypted in your browser with a key derived from your master passphrase, so the saved list can only be opened with that passphrase.",
    ],
    features: [
      { title: "Cryptographic randomness", body: "Values come from the browser's cryptographic random source rather than a predictable number generator." },
      { title: "Passwords or passphrases", body: "Generate something short and dense, or a sequence of words that is easier to type and remember." },
      { title: "Strength you can read", body: "An entropy readout shows why one option is stronger than another as you move the length and character toggles." },
      { title: "An encrypted vault", body: "Saved entries are encrypted with AES-GCM using a key derived from your passphrase with PBKDF2. The passphrase never leaves the page, which also means nobody can reset it for you." },
    ],
    steps: [
      "Pick a length and the character sets you want, or switch to passphrase mode.",
      "Copy the password, or read the entropy meter to decide whether it should be longer.",
      "To keep it, set a master passphrase and save the entry to the vault.",
    ],
    faqs: [
      { question: "Is the vault a real password manager?", answer: "No. It is a convenience for a handful of passphrases, encrypted in your browser. Use a dedicated password manager for anything you cannot afford to lose." },
      { question: "What happens if I forget the master passphrase?", answer: "The vault cannot be opened. The encryption key is derived from the passphrase and nothing stores it, so there is no reset and no recovery." },
      { question: "Do the passwords ever leave my browser?", answer: "The generator runs entirely on the page, and anything you save is encrypted before it is written to this browser's local storage." },
      { question: "How long should a password be?", answer: "Longer matters more than complicated. A sixteen-character random password, or a five-word passphrase, is a sensible default." },
    ],
  },

  imagecompressor: {
    headline: "Compress and resize images without uploading them",
    metaDescription:
      "Compress and resize JPEG, PNG and WebP images in your browser. Batch process, compare before and after sizes, and download — free, private, no sign-up.",
    summary: "Shrink images and change their dimensions, entirely on your own device.",
    intro: [
      "Image Compressor takes the weight out of photos and screenshots. Add files, choose how much to shrink them and how large they should be, and download the results — a batch at a time if you like.",
      "The work happens in your browser rather than on a server, which is both faster and more private: your files are never uploaded, so there is no copy to expire, log, or leak. Redrawing the image also strips its metadata, including GPS coordinates.",
    ],
    features: [
      { title: "Compress or resize, or both", body: "Cut the file size at the same dimensions, cap the width and height, or do both in one pass." },
      { title: "Batch friendly", body: "Add as many images as you want, watch the total savings, then download them individually or all at once." },
      { title: "Choose the format", body: "Keep the original, or convert to WebP for the web, JPEG for compatibility, or PNG when you need lossless quality." },
      { title: "Nothing is uploaded", body: "Files are decoded and re-encoded on your device with the canvas API, so they never leave it." },
    ],
    steps: [
      "Drop your images onto the page, paste a screenshot, or use the file picker.",
      "Pick an output format and quality, and set a maximum width or height if the images need to be smaller.",
      "Press Compress & resize, check the before-and-after sizes, then download what you need.",
    ],
    faqs: [
      { question: "Are my images uploaded to a server?", answer: "No. Your browser decodes and re-encodes each image locally, so the files never leave your device. You can unplug your connection after the page loads and it still works." },
      { question: "Which format should I choose?", answer: "WebP is usually the smallest at a quality nobody can tell apart, and every current browser supports it. Choose JPEG when another program has to read the file, and keep PNG only when you need lossless quality or transparency." },
      { question: "Why is my PNG not getting smaller?", answer: "PNG is lossless, so the quality setting does not apply — the same pixels always produce roughly the same bytes. Convert it to WebP or JPEG to shrink it meaningfully." },
      { question: "Does compressing remove EXIF and GPS data?", answer: "Yes. Redrawing the image drops the metadata block entirely, including the camera model, timestamps, and GPS coordinates — which is usually what you want before publishing a photo." },
    ],
    related: ["appscreenshot", "qrgenerator", "share"],
  },

  jokegenrator: {
    headline: "A joke for the moment you need one",
    metaDescription:
      "Generate a quick joke whenever you need a laugh. A free joke generator that runs in the browser, with no account and nothing to install.",
    summary: "Press the button, get a joke, press it again if that one did not land.",
    intro: [
      "The Joke Generator exists because sometimes you just need a joke and do not want to open five tabs looking for one.",
      "Ask for a joke and it hands you one. Ask again if that one did not land.",
    ],
    features: [
      { title: "Instant", body: "No account, no waiting through a loading screen, and no newsletter prompt on the way." },
      { title: "Ask again", body: "Keep requesting another until you find one worth repeating." },
      { title: "Take it with you", body: "Copy the joke into a chat window, a slide, or a card." },
      { title: "Nothing to install", body: "It runs in the browser on desktop and mobile." },
    ],
    steps: ["Open the tool.", "Ask for a joke.", "Ask again for the next one."],
    faqs: [
      { question: "Is it free?", answer: "Yes, and there is no account to create." },
      { question: "Can I use the jokes anywhere?", answer: "The generator is there to give you something to repeat. Use your own judgement about where it belongs." },
      { question: "Does it work on mobile?", answer: "Yes, it runs in any browser." },
    ],
  },

  wordoftheday: {
    headline: "Word of the Day: one new word, and how to use it",
    metaDescription:
      "Learn a new word every day with its definition and an example sentence. A free vocabulary habit that takes under a minute, with no sign-up.",
    summary: "A new word each day, with a definition and an example sentence.",
    intro: [
      "Word of the Day is a vocabulary habit small enough to keep. Each day brings one word with its definition and an example sentence showing it in context.",
      "Because it is a single word rather than a list, it takes under a minute — which is the point. One word you actually remember beats twenty you skim.",
    ],
    features: [
      { title: "One word a day", body: "A small, finishable dose of vocabulary instead of an overwhelming list you will not return to." },
      { title: "Definition and example", body: "The example sentence is what makes a new word stick, because it shows where the word belongs." },
      { title: "A daily habit", body: "The same word for everyone, refreshed each day." },
      { title: "Nothing to sign up for", body: "Open the page and read it. No account, no email address, no streak to maintain." },
    ],
    steps: [
      "Open the page for today's word.",
      "Read the definition and the example sentence.",
      "Try using the word once today — that is what makes it stay.",
    ],
    faqs: [
      { question: "Is there a new word every day?", answer: "Yes. The word refreshes daily, and it is the same one for everybody." },
      { question: "Do I need an account?", answer: "No. The page is public and free." },
      { question: "Is this a dictionary?", answer: "No. It is a daily habit, not a lookup service: one word at a time is what makes it stick. Use a dictionary when you need full coverage." },
    ],
  },

  subdomain: {
    headline: "Find the subdomains a domain is using",
    metaDescription:
      "Enumerate the subdomains of any domain. A free subdomain finder that queries public DNS, so you can see what a site actually publishes.",
    summary: "Look up which subdomains of a domain resolve, using public DNS.",
    intro: [
      "Subdomain Finder asks public DNS which names exist under a domain, so you can see the hosts a site actually uses — mail, docs, an API, staging, and whatever else is published.",
      "That is useful for auditing what your own infrastructure exposes, and for understanding how someone else's site is put together from the outside.",
    ],
    features: [
      { title: "Public DNS only", body: "Lookups go through ordinary resolvers, so nothing is scanned, probed, or exploited." },
      { title: "Common names first", body: "The usual suspects — www, mail, api, docs, staging — are checked alongside the domain's own records." },
      { title: "Works on any domain", body: "Point it at your own site to audit what you expose, or at a public one to understand its layout." },
      { title: "No sign-up", body: "It runs in the browser against public resolvers, with nothing to install." },
    ],
    steps: [
      "Enter the domain you want to inspect.",
      "Run the lookup and read which names resolve.",
      "Use the results to review what your own domain publishes, or to understand another site's structure.",
    ],
    faqs: [
      { question: "Is this legal?", answer: "Querying public DNS for names under a domain reads information that is already public. Use it on your own infrastructure or for research — not to attack anything." },
      { question: "Why are some subdomains missing?", answer: "Only names that resolve publicly will show up. Internal hosts, wildcard-only setups, and names behind a private resolver stay invisible." },
      { question: "Does it find every subdomain?", answer: "No. Any enumeration can only guess and check names, so treat what it returns as a partial picture rather than a full inventory." },
    ],
    related: ["isittaken", "isitdown", "iframetester"],
  },

  nikoschultz: {
    headline: "An 800m runner's results, milestones and videos in one place",
    metaDescription:
      "Follow Niko Schultz, a Puerto Rico-eligible 800m runner: verified meet results, career milestones, race videos and the official profile links.",
    summary: "Verified results, milestones and race video for an 800m runner, with every official profile in one place.",
    intro: [
      "Niko Schultz runs the 800m. This is the page that keeps his season in one place: the meets he has run, the times that came out of them, and the marks that were worth remembering.",
      "Everything on it is meant to be checkable. Results are listed alongside the meet and date they came from, videos sit next to the race they belong to, and the official profiles linked from the page are the ones that publish his entries.",
    ],
    features: [
      { title: "Verified results", body: "Each mark is shown with the meet and the date it was run at, so a time can be traced back to the result that produced it." },
      { title: "Milestones", body: "Personal bests, breakthroughs and season highlights are collected in one list instead of being spread across a feed." },
      { title: "Race videos", body: "Races that were filmed are grouped with the result, so the time and the run that produced it are never far apart." },
      { title: "Official profiles", body: "The outside profiles — results databases, social accounts — are linked in one place, so a recruiter does not have to hunt for them." },
    ],
    steps: [
      "Open the page for the current season overview and the latest results.",
      "Use the results list to read a specific meet, its date and the time run there.",
      "Follow a video or an official profile link for the primary source behind a listing.",
    ],
    faqs: [
      { question: "Who is Niko Schultz?", answer: "An 800m runner eligible to represent Puerto Rico. The page keeps his results, milestones, race videos and official profile links together." },
      { question: "Where do the results come from?", answer: "They are listed with the meet and date they were run at. Where a race was recorded or published elsewhere, the page links out to that source rather than restating it." },
      { question: "Can coaches or recruiters use the page?", answer: "Yes. That is what it is for: an at-a-glance record of times, milestones and video, plus the official profiles that carry the entries." },
    ],
  },

  sawyerschulz: {
    headline: "A student developer's portfolio, and the races beside it",
    metaDescription:
      "Sawyer's portfolio and running profile: student development projects, technical skills, competitive distance-running results, and how to get in touch.",
    summary: "Projects, skills and technical work from a student developer, next to a competitive distance runner's race record.",
    intro: [
      "Sawyer is a student developer and a competitive distance runner. This site holds both halves of that: the things he has built, and the races he has run.",
      "The portfolio side lists projects and the technical skills behind them. The running side lists race results. Both are written as a personal record rather than a product page, which is why contact details sit right at the end.",
    ],
    features: [
      { title: "Project portfolio", body: "The development work is collected in one place, each project described by what it does rather than only by its name." },
      { title: "Technical skills", body: "The languages, tools and platforms behind those projects are listed as a readable, honest summary of what he works in." },
      { title: "Race results", body: "Distance-running results sit alongside the portfolio, so the competitive record is as easy to find as the code." },
      { title: "Contact details", body: "A direct way to get in touch, for anyone who has read the work and wants to ask about it." },
    ],
    steps: [
      "Open the site for the portfolio overview and the current project list.",
      "Read a project for what it does and the skills it was built with.",
      "Scroll on to the race results, or use the contact details at the end to get in touch.",
    ],
    faqs: [
      { question: "Who is Sawyer?", answer: "A student developer and competitive distance runner from Minnetonka. His site is a portfolio of development work alongside his running record." },
      { question: "What is on the site?", answer: "Projects and the technical skills behind them, a list of race results, and contact details — a personal record rather than a product page." },
      { question: "Is the source code available?", answer: "The portfolio describes the work itself. If you want to talk about a specific project, the contact details at the end of the page are the way in." },
    ],
  },

  backgroundremover: {
    headline: "Remove an image background in your browser, free",
    metaDescription:
      "Remove the background from a photo in your browser, replace it with a colour or gradient, and download a transparent PNG — free, private, no sign-up.",
    summary: "Clear a photo's backdrop on your own device, then restyle it and save a transparent PNG.",
    intro: [
      "Background Remover takes the backdrop out of a picture without sending it anywhere. Drop in a photo, clear the background in one click, then place the subject on a new colour, a gradient, or nothing at all — a fully transparent PNG.",
      "The work happens in your browser rather than on a server, so your files stay on your device: there is no copy to expire, log or leak. A tolerance slider and a click-to-erase brush clean up stubborn edges, and padding, a drop shadow and a trim control finish the job.",
    ],
    features: [
      { title: "One-click removal", body: "The tool samples the colours along the image edges and clears the connected backdrop, which is fastest against a plain wall or a solid colour." },
      { title: "Replace the backdrop", body: "Keep it transparent, or drop the subject onto any colour, a two-colour gradient, or a soft drop shadow." },
      { title: "Click to erase", body: "Any leftover patch can be removed by hand: turn on Erase by hand and click it away, with Undo always a step behind." },
      { title: "Nothing is uploaded", body: "Redrawing and re-encoding the image on your device means the file never leaves the browser, so there is no server copy to leak." },
    ],
    steps: [
      "Drop an image onto the page, paste it, or choose a file from your device.",
      "Press Remove background, then adjust the tolerance or click to erase anything left over.",
      "Choose a background, add a shadow or padding if you want them, and download a transparent PNG.",
    ],
    faqs: [
      { question: "Are my images uploaded to a server?", answer: "No. Your browser reads, edits and saves the picture locally, so the file never leaves your device. You can unplug your connection after the page loads and it still works." },
      { question: "How does the removal work?", answer: "It samples the colours along the edges and clears the connected pixels that match that backdrop, which is most reliable on plain or lightly textured backgrounds. The tolerance slider controls how much is cleared, and clicking any remaining patch erases it by hand." },
      { question: "Which format should I download?", answer: "PNG keeps a fully transparent background and suits most uses. WebP is smaller and also supports transparency. JPEG cannot store transparency, so the cleared area is filled with your chosen colour or white." },
      { question: "Does it work on a phone?", answer: "Yes, the layout stacks on small screens. Very large images are limited by your device's memory rather than by the tool, so process one at a time on a phone." },
    ],
    related: ["imagecompressor", "appscreenshot", "qrgenerator"],
  },
  focus: {
    headline: "Stay focused with a simple timer for deep work",
    metaDescription:
      "A simple focus timer for deep work, study sessions and daily routines. Set a session, remove distractions and keep your attention on one task.",
    summary: "A quiet focus timer for work, study and any task that deserves your full attention.",
    intro: [
      "Focus is a deliberately small tool for the moment when you want to do one thing and not be pulled into five others. Set a session, start the clock and keep the page out of your way while you work.",
      "It is useful for a study block, a writing sprint, a workout of concentrated coding or a daily routine you are trying to make automatic. There is no account to create and no complicated system to learn before you begin.",
    ],
    features: [
      { title: "One task at a time", body: "A focused surface keeps the session about the work in front of you instead of turning planning into another distraction." },
      { title: "Flexible sessions", body: "Choose a duration that fits the task, whether you need a short reset or a longer block of uninterrupted work." },
      { title: "Useful on any device", body: "The tool runs in your browser and adapts to a phone, tablet or desktop without an app to install." },
      { title: "No account required", body: "Start a session immediately without creating a profile, handing over an email address or signing up for a subscription." },
    ],
    steps: [
      "Open Focus and choose how long you want to work.",
      "Start the session, then keep the page open while you give the task your attention.",
      "When the timer ends, take a short break or begin another focused block.",
    ],
    faqs: [
      { question: "What is Focus for?", answer: "It is a simple browser timer for deep work, studying, writing, coding and other tasks that are easier when you protect a block of uninterrupted attention." },
      { question: "Do I need an account?", answer: "No. Focus is available without an account, password or subscription." },
      { question: "Can I use it on my phone?", answer: "Yes. It runs in a mobile browser as well as on a desktop, so you can use the same kind of session wherever you work." },
    ],
    related: ["dailywordel", "backgroundremover", "appscreenshot"],
  },
};

const tagsBySlug = new Map(
  (sitesConfig as { subdomain: string; tags?: string[]; show?: boolean }[]).map((site) => [site.subdomain, site.tags ?? []]),
);

/** Slugs that have a page *and* are published in the directory. */
export const publishedToolSlugs = (): string[] =>
  Object.keys(toolPages).filter((slug) => {
    const site = (sitesConfig as { subdomain: string; show?: boolean }[]).find((entry) => entry.subdomain === slug);
    return !!site && site.show !== false;
  });

export const getToolPage = (slug: string): ToolPage | undefined => toolPages[slug];

/**
 * Sibling pages to link at the end of a tool page: whichever share the most
 * tags first, then alphabetical, so the block is deterministic and never comes
 * up short. An explicit `related` list wins where the order matters more than
 * the tags do.
 */
export const relatedToolSlugs = (slug: string, limit = 3): string[] => {
  const explicit = toolPages[slug]?.related;
  if (explicit?.length) return explicit.slice(0, limit);
  const tags = tagsBySlug.get(slug) ?? [];
  return Object.keys(toolPages)
    .filter((key) => key !== slug)
    .map((key) => ({ key, shared: (tagsBySlug.get(key) ?? []).filter((tag) => tags.includes(tag)).length }))
    .sort((a, b) => b.shared - a.shared || a.key.localeCompare(b.key))
    .slice(0, limit)
    .map((entry) => entry.key);
};

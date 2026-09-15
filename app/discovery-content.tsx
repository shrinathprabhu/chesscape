import { faqs } from '@/lib/discovery';
export default function DiscoveryContent() {
  return (
    <div className="discovery-content">
      <section
        id="about"
        aria-labelledby="about-heading"
        className="game-guide"
      >
        <div>
          <p className="eyebrow">A LITTLE CHESS, EVERY DAY</p>
          <h2 id="about-heading">A daily chess puzzle with an escape twist.</h2>
          <p>
            Chesscape is a free, 30-second defensive chess challenge. Your king
            is in danger, and only one or two legal moves avoid checkmate on the
            next turn. Find a safe move, keep trying until you solve it, and
            share your escape time.
          </p>
          <p>
            Play on your phone, tablet or desktop. Your progress stays in this
            browser, so an unfinished escape is waiting when you return.
          </p>
        </div>
        <ol className="guide-steps" aria-label="How to play Chesscape">
          <li>
            <h3>Reveal the position</h3>
            <p>
              Press start when you’re ready. Your 30 seconds begin immediately.
            </p>
          </li>
          <li>
            <h3>Find the safe move</h3>
            <p>
              Tap a piece and a highlighted destination. A wrong move or timeout
              ends this try; retry the same board with a fresh timer.
            </p>
          </li>
          <li>
            <h3>Escape, then come back</h3>
            <p>
              Save or share your board and time. After a solve, the next puzzle
              unlocks at midnight UTC.
            </p>
          </li>
        </ol>
      </section>
      <section id="faq" aria-labelledby="faq-heading" className="faq-section">
        <h2 id="faq-heading">Questions about your next escape.</h2>
        <div className="faq-list">
          {faqs.map((faq) => (
            <details key={faq.id} id={faq.id}>
              <summary>{faq.question}</summary>
              <div>
                <p>{faq.answer}</p>
                {faq.links && (
                  <p className="faq-links">
                    {faq.links.map((link) => (
                      <a
                        key={link.url}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {link.label} <span aria-hidden="true">↗</span>
                      </a>
                    ))}
                  </p>
                )}
              </div>
            </details>
          ))}
        </div>
      </section>
      <section
        id="creators"
        aria-labelledby="creators-heading"
        className="creators-section"
      >
        <div>
          <p className="eyebrow">THE PEOPLE BEHIND THE POSITION</p>
          <h2 id="creators-heading">Your king has a whole team behind it.</h2>
          <p>
            Chesscape is part of{' '}
            <a
              href="https://lowkey.tools"
              target="_blank"
              rel="noopener noreferrer"
            >
              lowkey.tools
            </a>{' '}
            — small browser tools for the rest of your day.
          </p>
        </div>
        <article>
          <h3>Made by Shrinath Prabhu</h3>
          <p>
            Chesscape is one of Shrinath’s small browser tools. Explore the
            products he’s built and the engineering behind them.
          </p>
          <a
            href="https://shrinath.me"
            target="_blank"
            rel="noopener noreferrer"
          >
            Meet Shrinath Prabhu <span aria-hidden="true">↗</span>
          </a>
          <p>
            <a
              href="https://x.com/shrinath_prabhu"
              target="_blank"
              rel="noopener noreferrer"
            >
              Follow @shrinath_prabhu on X <span aria-hidden="true">↗</span>
            </a>
          </p>
        </article>
        <article>
          <h3>From the maker of OwlEye Analytics</h3>
          <p>
            Building a website of your own? OwlEye is Shrinath’s hosted,
            cookie-free web analytics product for founders and product teams.
          </p>
          <a
            href="https://owleye.dev"
            target="_blank"
            rel="noopener noreferrer"
          >
            Explore OwlEye Analytics <span aria-hidden="true">↗</span>
          </a>
        </article>
      </section>
      <section
        className="off-board-section"
        aria-labelledby="off-board-heading"
      >
        <div className="off-board-heading">
          <p className="eyebrow">YOUR NEXT MOVE</p>
          <h2 id="off-board-heading">Good moves, off the board.</h2>
          <p>Keep the insight after the clock stops.</p>
        </div>
        <div className="off-board-grid">
          <article>
            <h3>That escape deserves a note.</h3>
            <p>
              A clever line, a useful link, a half-formed idea. Give it a home
              in SuperBrain, your private, local-first notebook.
            </p>
            <a
              href="https://lowkey.tools/superbrain"
              target="_blank"
              rel="noopener noreferrer"
            >
              Save the thought in SuperBrain <span aria-hidden="true">↗</span>
            </a>
          </article>
        </div>
        <a
          className="more-lowkey"
          href="https://lowkey.tools"
          target="_blank"
          rel="noopener noreferrer"
        >
          There’s more beyond the board. Explore lowkey.tools{' '}
          <span aria-hidden="true">↗</span>
        </a>
      </section>
      <nav className="discovery-links" aria-label="Site information">
        <a href="#main-content">Back to the chess puzzle ↑</a>
        <a href="#faq">Chesscape FAQ</a>
      </nav>
    </div>
  );
}

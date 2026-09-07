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
          <p className="eyebrow">FROM THE LOWKEY FAMILY</p>
          <h2 id="creators-heading">Small tools. Thoughtfully made.</h2>
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
        </article>
        <article>
          <h3>Discover OwlEye Analytics</h3>
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
      <nav className="discovery-links" aria-label="Site information">
        <a href="#main-content">Back to the chess puzzle ↑</a>
        <a href="#faq">Chesscape FAQ</a>
      </nav>
    </div>
  );
}

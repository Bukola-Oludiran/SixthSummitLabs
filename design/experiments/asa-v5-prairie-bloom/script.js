const menuButton = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#navigation');
function closeMenu() {
  menuButton.setAttribute('aria-expanded', 'false');
  navigation.classList.remove('is-open');
  menuButton.querySelector('span').textContent = '+';
}
menuButton.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') !== 'true';
  menuButton.setAttribute('aria-expanded', String(open));
  navigation.classList.toggle('is-open', open);
  menuButton.querySelector('span').textContent = open ? '−' : '+';
});
navigation.addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') {
    closeMenu(); menuButton.focus();
  }
});
document.addEventListener('click', event => {
  if (!event.target.closest('.site-header')) closeMenu();
});
window.matchMedia('(min-width: 761px)').addEventListener('change', event => { if (event.matches) closeMenu(); });
const hints = {
  'Just because': 'A little everyday joy. Start a conversation about seasonal stems.',
  'A celebration': 'A moment worth marking. Tell us the occasion and what you have in mind.',
  'Something personal': 'A favourite colour or a meaningful stem. Let’s start with your inspiration.'
};
function chooseOccasion(choice) {
  document.querySelectorAll('[data-choice]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.choice === choice)));
  document.querySelector('#occasion-hint').textContent = hints[choice];
  document.querySelector('#occasion-email').href = `mailto:hello@example.invalid?subject=${encodeURIComponent(`Flowers — ${choice}`)}`;
}
document.querySelectorAll('[data-choice]').forEach(button => button.addEventListener('click', () => chooseOccasion(button.dataset.choice)));
document.querySelectorAll('[data-occasion]').forEach(link => link.addEventListener('click', () => chooseOccasion(link.dataset.occasion)));

export const AnimatedBackground = () => {
  const elements = [
    { emoji: "⭐", delay: "0s", position: { top: "10%", left: "5%" } },
    { emoji: "✨", delay: "0.5s", position: { top: "20%", right: "10%" } },
    { emoji: "🎮", delay: "1s", position: { top: "60%", left: "8%" } },
    { emoji: "🎯", delay: "1.5s", position: { top: "70%", right: "15%" } },
    { emoji: "🎪", delay: "2s", position: { top: "30%", left: "15%" } },
    { emoji: "🎨", delay: "2.5s", position: { top: "50%", right: "5%" } },
    { emoji: "⚡", delay: "3s", position: { top: "80%", left: "20%" } },
    { emoji: "💫", delay: "3.5s", position: { top: "15%", right: "25%" } },
  ];

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {elements.map((element, index) => (
        <div
          key={index}
          className="absolute text-4xl floating-animation opacity-20"
          style={{
            ...element.position,
            animationDelay: element.delay,
          }}
        >
          {element.emoji}
        </div>
      ))}
      
      {/* Hidden Charlie in corner */}
      <div 
        className="absolute bottom-4 right-4 text-6xl opacity-30 hover:opacity-100 transition-opacity bounce-animation cursor-pointer"
        title="Tu m'as trouvé ! 🎉"
      >
        🕵️
      </div>
    </div>
  );
};

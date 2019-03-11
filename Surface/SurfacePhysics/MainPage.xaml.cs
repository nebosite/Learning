using Windows.UI.Xaml.Controls;
using Windows.UI;
using System.Numerics;
using Microsoft.Graphics.Canvas;
using Microsoft.Graphics.Canvas.Effects;
using Microsoft.Graphics.Canvas.UI.Xaml;
using Microsoft.Graphics.Canvas.Text;
using Windows.UI.Xaml.Media;
using Microsoft.Graphics.Canvas.UI;
using Windows.Foundation;


// The Blank Page item template is documented at https://go.microsoft.com/fwlink/?LinkId=402352&clcid=0x409

namespace SurfacePhysics
{
    /// <summary>
    /// An empty page that can be used on its own or navigated to within a Frame.
    /// </summary>
    public sealed partial class MainPage : Page
    {
        public MainPage()
        {
            this.InitializeComponent();
        }

        class SimpleThing
        {
            public Vector2 Position;
            public Vector2 Velocity;
        }

        SimpleThing _circle = new SimpleThing() { Position = new Vector2(400, 400) };

        CanvasCommandList _helloWorld;
        private void CanvasDraw(CanvasAnimatedControl sender, CanvasDrawEventArgs args)
        {
        }

        private void Page_Unloaded(object sender, Windows.UI.Xaml.RoutedEventArgs e)
        {
            TheCanvas.RemoveFromVisualTree();
            TheCanvas = null;
        }

        private void TheCanvas_CreateResources(CanvasAnimatedControl sender, CanvasCreateResourcesEventArgs args)
        {
            _helloWorld = new CanvasCommandList(sender);
            using (var session = _helloWorld.CreateDrawingSession())
            {
                session.DrawText("Hello, World!", 100, 100, Colors.Black, new CanvasTextFormat() { FontSize = 80 });
            }
        }

        private void DrawFrame(ICanvasAnimatedControl sender, CanvasAnimatedDrawEventArgs args)
        {
            var blur = new GaussianBlurEffect();
            blur.Source = _helloWorld;
            blur.BlurAmount = 10.0f;
            args.DrawingSession.DrawImage(blur);

            args.DrawingSession.DrawCircle(_circle.Position, 10, Colors.Green);
        }

        private void TheCanvas_Update(ICanvasAnimatedControl sender, CanvasAnimatedUpdateEventArgs args)
        {
            _circle.Velocity += new Vector2(0, 1);
            _circle.Position += _circle.Velocity;
            if (_circle.Position.Y > 500)
            {
                _circle.Position.Y = 500;
                _circle.Velocity.Y *= -1;
            }

        }
    }
}

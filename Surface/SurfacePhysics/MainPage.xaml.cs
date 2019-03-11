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
using VelcroPhysics.Dynamics;
using MG = Microsoft.Xna.Framework;
using VelcroPhysics.Utilities;
using VelcroPhysics.Factories;
using System.Collections.Generic;


// The Blank Page item template is documented at https://go.microsoft.com/fwlink/?LinkId=402352&clcid=0x409

namespace SurfacePhysics
{
    /// <summary>
    /// An empty page that can be used on its own or navigated to within a Frame.
    /// </summary>
    public sealed partial class MainPage : Page
    {
        private readonly World _world;
        private List<Body> _circleBodies = new List<Body>();
        private Body _groundBody;
        const float PixelsPerMeter = 14.0f;

        public MainPage()
        {
            this.InitializeComponent();
            _world = new World(new MG.Vector2(0, 9.82f));
            ConvertUnits.SetDisplayUnitToSimUnitRatio(PixelsPerMeter); // pixels per meter
            for(int i = 0; i < 3; i++)
            {
                var circleBody = BodyFactory.CreateCircle(
                    _world,
                    1f, // radius
                    1f, // density
                    new MG.Vector2(i / 2.0f, -15 + i * 2.8f),
                    BodyType.Dynamic);
                circleBody.Restitution = 0.8f;
                circleBody.Friction = 0.2f;
                _circleBodies.Add(circleBody);
            }

            _groundBody = BodyFactory.CreateRectangle(_world, 50,1, 1f, new MG.Vector2(0,0));
            _groundBody.BodyType = BodyType.Static;
            _groundBody.Restitution = 0.3f;
            _groundBody.Friction = 0.5f;
        }


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

            //args.DrawingSession.DrawCircle(_circle.Position.X, _circle.Position.Y, 10, Colors.Green);

            foreach(var circleBody in _circleBodies)
            {
                var circlePosition = ConvertUnits.ToDisplayUnits(circleBody.WorldCenter);
                var circleRadius = ConvertUnits.ToDisplayUnits(1f);
                args.DrawingSession.DrawCircle(circlePosition.X + 600, circlePosition.Y + 500, circleRadius, Colors.Green);

            }

            var groundPosition = ConvertUnits.ToDisplayUnits(_groundBody.WorldCenter);
            var groundWidth = ConvertUnits.ToDisplayUnits(50);
            var groundHeight = ConvertUnits.ToDisplayUnits(1);
            var groundRectangle = new Rect(
                groundPosition.X + 600 - groundWidth / 2,
                groundPosition.Y + 500 - groundHeight / 2,
                groundWidth,
                groundHeight);
            args.DrawingSession.DrawRectangle(groundRectangle, Colors.Brown);

        }

        private void TheCanvas_Update(ICanvasAnimatedControl sender, CanvasAnimatedUpdateEventArgs args)
        {
            //_circle.Velocity += new MG.Vector2(0, 1);
            //_circle.Position += _circle.Velocity;
            //if (_circle.Position.Y > 500)
            //{
            //    _circle.Position.Y = 500;
            //    _circle.Velocity.Y *= -1;
            //}
            _world.Step((float)args.Timing.ElapsedTime.TotalSeconds);
        }
    }
}

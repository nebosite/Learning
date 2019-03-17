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
using System;
using System.Linq;


// The Blank Page item template is documented at https://go.microsoft.com/fwlink/?LinkId=402352&clcid=0x409

namespace SurfacePhysics
{
    /// <summary>
    /// An empty page that can be used on its own or navigated to within a Frame.
    /// </summary>
    public sealed partial class MainPage : Page
    {
        private readonly World _world;
        private List<PhysicsObject> _objects = new List<PhysicsObject>();
        float _pixelsPerMeter = 20;
        MG.Vector2 _screenOrigin = new MG.Vector2(600, 800);



        public MainPage()
        {
            var random = new Random();
            this.InitializeComponent();
            _world = new World(new MG.Vector2(0, 9.82f));
          


            for(int x = -4; x < 4; x++)
            {
                for (int y = -14; y < -4; y++)
                {
                    _objects.Add(new Ball(_world, .4f, x + ((float)random.NextDouble()/2), y + ((float)random.NextDouble() / 2)));
                }
            }

            _objects.Add(new StickyBlock(_world, 50, 1, 0, 0, 0));
            _objects.Add(new StickyBlock(_world, 1, 1, 0, -2, 0));
            _objects.Add(new StickyBlock(_world, 1, 10, -20, -5, 0));
            _objects.Add(new StickyBlock(_world, 1, 10, 20, -5, 0));

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

            foreach(var drawMe in _objects)
            {
                drawMe.DrawMe(args.DrawingSession, new MG.Vector2(600, 800), _pixelsPerMeter);
            }

        }

        private void TheCanvas_Update(ICanvasAnimatedControl sender, CanvasAnimatedUpdateEventArgs args)
        {
            foreach(var activePoint in _activePoints.Values.ToArray())
            {
                foreach(Ball ball in _objects.Where(o => o is Ball))
                {
                    if(Math.Abs(ball.WorldPostition.X - activePoint.X ) < 1)
                    {
                        ball.AddVelocity(0, -.8f);
                    }
                }
            }
            _world.Step((float)args.Timing.ElapsedTime.TotalSeconds);
        }

        Dictionary<uint, MG.Vector2> _activePoints = new Dictionary<uint, MG.Vector2>();
        private void SetActivePointer(Windows.UI.Xaml.Input.PointerRoutedEventArgs e)
        {
            var point = e.GetCurrentPoint(TheCanvas);
            var worldPosition = (new MG.Vector2((float)point.Position.X, (float)point.Position.Y) - _screenOrigin) / _pixelsPerMeter;
            _activePoints[e.Pointer.PointerId] = worldPosition;
        }


        private void Pointer_Pressed(object sender, Windows.UI.Xaml.Input.PointerRoutedEventArgs e)
        {
            SetActivePointer(e);
        }

        private void Pointer_Released(object sender, Windows.UI.Xaml.Input.PointerRoutedEventArgs e)
        {

            _activePoints.Remove(e.Pointer.PointerId);
        }

        private void Pointer_Moved(object sender, Windows.UI.Xaml.Input.PointerRoutedEventArgs e)
        {
            if(_activePoints.ContainsKey(e.Pointer.PointerId))
            {
                SetActivePointer(e);
            }
            // Prevent most handlers along the event route from handling the same event again.
            e.Handled = true;
        }
    }
}

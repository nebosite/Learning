using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Diagnostics;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.DataVisualization.Charting;
using System.Windows.Data;
using System.Windows.Documents;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Media.Media3D;
using System.Windows.Navigation;
using System.Windows.Shapes;

namespace SkyNet
{

    /// <summary>
    /// Interaction logic for MainWindow.xaml
    /// </summary>
    public partial class MainWindow : Window, IChartPlotter
    {
        MainModel _mainModel;
        Thread moverThread;
        bool _running = true;
        Model3DGroup mainGroup;
        Transform3DGroup _worldTransform = new Transform3DGroup();
        Transform3DGroup _earthTransform = new Transform3DGroup();
        Transform3DGroup _coverageTransform = new Transform3DGroup();
        double _globalTimeSeconds = 0;

        //-------------------------------------------------------------------------------------
        /// <summary>
        /// Constructor
        /// </summary>
        //-------------------------------------------------------------------------------------
        public MainWindow()
        {
            _mainModel = new MainModel(this);
            InitializeComponent();
            this.DataContext = _mainModel;
            SetupWorld();
            _mainModel.Dispatcher = this.Dispatcher;
        }

        //-------------------------------------------------------------------------------------
        /// <summary>
        /// SetupWorld
        /// </summary>
        //-------------------------------------------------------------------------------------
        private void SetupWorld()
        {
            CompositionTarget.Rendering += DrawFrame;
            moverThread = new Thread(Mover);
            moverThread.Start();



            mainGroup = new Model3DGroup();

            var earthModel = ModelHelper.CreateSphereModel(1);
            var coverageModel = ModelHelper.CreateSphereModel(1.004);

            var image = new BitmapImage(new Uri("earthmap10k_reduced.jpg", UriKind.Relative));
            var imageBrush = new ImageBrush(image) { ViewportUnits = BrushMappingMode.Absolute };
            earthModel.Material = new DiffuseMaterial(imageBrush); //new DiffuseMaterial(Brushes.Black)
            mainGroup.Children.Add(earthModel);
            earthModel.Transform = _earthTransform;

            var heatMapBrush = new ImageBrush(_mainModel._heatMap.Bitmap) { ViewportUnits = BrushMappingMode.Absolute };
            coverageModel.Material = new DiffuseMaterial(heatMapBrush);
            coverageModel.Transform = _coverageTransform;
            mainGroup.Children.Add(coverageModel);

            EarthScene.Content = mainGroup;

            mainGroup.Transform = _worldTransform;
        }


        //-------------------------------------------------------------------------------------
        /// <summary>
        /// Mover
        /// </summary>
        //-------------------------------------------------------------------------------------
        void Mover(object state)
        {
            var timer = new Stopwatch();
            timer.Restart();
            double lastTimeSeconds = 0;

            while (_running)
            {
                double newTimeSeconds = timer.Elapsed.TotalSeconds;
                double deltaSeconds = newTimeSeconds - lastTimeSeconds;
                _mainModel.Move(deltaSeconds);
                lastTimeSeconds = newTimeSeconds;
            }
        }

        //-------------------------------------------------------------------------------------
        /// <summary>
        /// DrawFrame
        /// </summary>
        //-------------------------------------------------------------------------------------
        private void DrawFrame(object sender, EventArgs e)
        {
            _earthTransform.Children.Clear();
            double r = PhysicalConstants.EARTHRADIUS_METERS / 1000;
            _earthTransform.Children.Add(new ScaleTransform3D(r, r, r));
            _earthTransform.Children.Add(new RotateTransform3D(new AxisAngleRotation3D(new Vector3D(0, 1, 0), _mainModel.EarthRotationDegrees)));

            _coverageTransform.Children.Clear();
            _coverageTransform.Children.Add(new ScaleTransform3D(r, r, r));

            _worldTransform.Children.Clear();
            _worldTransform.Children.Add(new RotateTransform3D(new AxisAngleRotation3D(new Vector3D(0, 1, 0), _rotationZ)));
            _worldTransform.Children.Add(new RotateTransform3D(new AxisAngleRotation3D(new Vector3D(1, 0, 0), _rotationX)));
            RenderingEventArgs renderArgs = (RenderingEventArgs)e;

            _mainModel.RenderToHeatMap(12);

            foreach(var item in _mainModel.Satellites)
            {
                // Make sure the satellite has a 3D model and render it
                if (item.Model == null)
                {
                    item.Model = ModelHelper.CreateSatelliteModel(mainGroup);
                    item.Model.Material = new DiffuseMaterial(Brushes.Red);
                    mainGroup.Children.Add(item.Model);
                }
                var itemTransform = new Transform3DGroup();
                itemTransform.Children.Add(new ScaleTransform3D(1000, 1000, 1000));
                itemTransform.Children.Add(new TranslateTransform3D(item.Location.X / 1000, item.Location.Y / 1000, item.Location.Z / 1000));
                item.Model.Transform = itemTransform;  
              
            }
        }

        //-------------------------------------------------------------------------------------
        /// <summary>
        /// </summary>
        //-------------------------------------------------------------------------------------
        private void Window_Closing(object sender, System.ComponentModel.CancelEventArgs e)
        {
            _running = false;
            _mainModel.Dispose();
        }

        //-------------------------------------------------------------------------------------
        /// <summary>
        /// </summary>
        //-------------------------------------------------------------------------------------
        private void PlanetDisplay_MouseWheel(object sender, MouseWheelEventArgs e)
        {
            _mainModel.Scale *= ((e.Delta / 1000.0) + 1);
        }

        bool _dragging = false;
        Point _lastSpot;
        double _rotationX = 0;
        double _rotationZ = 0;
        //-------------------------------------------------------------------------------------
        /// <summary>
        /// </summary>
        //-------------------------------------------------------------------------------------
        private void Planet3DDisplay_MouseDown(object sender, MouseButtonEventArgs e)
        {
            Planet3DDisaply.CaptureMouse();
            _dragging = true;
            _lastSpot = Mouse.GetPosition(sender as IInputElement);
        }

        //-------------------------------------------------------------------------------------
        /// <summary>
        /// </summary>
        //-------------------------------------------------------------------------------------
        private void Planet3DDisplay_MouseMove(object sender, MouseEventArgs e)
        {
            if (_dragging)
            {
                var spot = Mouse.GetPosition(sender as IInputElement);
                var deltaX = spot.X - _lastSpot.X;
                var deltaY = spot.Y - _lastSpot.Y;
                _rotationZ += deltaX/10.0;
                _rotationX -= deltaY/10.0;
                _lastSpot = spot;
            }
        }

        //-------------------------------------------------------------------------------------
        /// <summary>
        /// </summary>
        //-------------------------------------------------------------------------------------
        private void Planet3DDisplay_MouseUp(object sender, MouseButtonEventArgs e)
        {
            _dragging = false;
            Planet3DDisaply.ReleaseMouseCapture();
        }

        //-------------------------------------------------------------------------------------
        /// <summary>
        /// </summary>
        //-------------------------------------------------------------------------------------
        private void Planet3DDisplay_MouseWheel(object sender, MouseWheelEventArgs e)
        {
            if (e.Delta > 0) _mainModel.FieldOfView /= 1.1;
            else _mainModel.FieldOfView *= 1.1;
        }

        //-------------------------------------------------------------------------------------
        /// <summary>
        /// </summary>
        //-------------------------------------------------------------------------------------
        private void Regenerate_Click(object sender, RoutedEventArgs e)
        {
            CompositionTarget.Rendering -= DrawFrame;

            _running = false;
            Thread.Sleep(100);

            SetupNewChartLine();

            _mainModel.RegenerateSatellites();
            SetupWorld();

            _running = true;
            CompositionTarget.Rendering += DrawFrame;
            moverThread = new Thread(Mover);
            moverThread.Start();

        }

        int series = 0;
        Brush[] _brushes = new[] { Brushes.Red, Brushes.Blue, Brushes.Green, Brushes.Purple, Brushes.Orange, Brushes.Black };
        public ObservableCollection<KeyValuePair<double, double>> CurrentLinePoints { get; set; }

        //-------------------------------------------------------------------------------------
        /// <summary>
        /// </summary>
        //-------------------------------------------------------------------------------------
        private void SetupNewChartLine()
        {
           
            var pointStyle = new Style(typeof(ScatterDataPoint));
            pointStyle.Setters.Add(new Setter(ScatterDataPoint.ForegroundProperty, _brushes[series % _brushes.Length]));
            pointStyle.Setters.Add(new Setter(ScatterDataPoint.BackgroundProperty, _brushes[series % _brushes.Length]));
            pointStyle.Setters.Add(new Setter(ScatterDataPoint.BorderBrushProperty, Brushes.Transparent));
            pointStyle.Setters.Add(new Setter(ScatterDataPoint.BorderThicknessProperty, new Thickness(0)));
            pointStyle.Setters.Add(new Setter(ScatterDataPoint.HeightProperty, 3.0));
            pointStyle.Setters.Add(new Setter(ScatterDataPoint.WidthProperty, 3.0));

            var newLine = new ScatterSeries();
            newLine.Title = _mainModel.CurrentSatelliteConfigLabel;
            newLine.DependentValuePath = "Value";
            newLine.IndependentValuePath = "Key";
            newLine.DataPointStyle = pointStyle;

            CurrentLinePoints = new ObservableCollection<KeyValuePair<double, double>>();
            newLine.ItemsSource = CurrentLinePoints;
            MyChart.Series.Add(newLine);
            series++;
        }

        //-------------------------------------------------------------------------------------
        /// <summary>
        /// </summary>
        //-------------------------------------------------------------------------------------
        public void AddPoint(double hours, double coverage)
        {
            if (CurrentLinePoints == null) return;

            Action drawPointAction = () =>
            {
                CurrentLinePoints.Add(new KeyValuePair<double, double>(hours, coverage));
            };

            Dispatcher.Invoke(drawPointAction);
        }
    }
}

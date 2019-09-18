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
using System.Windows.Media;
using System.Windows.Media.Imaging;

namespace SkyNet
{
    public static class PhysicalConstants
    {
        public const double EARTHRADIUS_METERS = 6371000;
        public const double G_MKGS = 6.67e-11;
        public const double EARTHMASS_KG = 5.972e24;
        public const double GM_EARTH = G_MKGS * EARTHMASS_KG;
        public static Random Rand = new Random();
        public const double SECONDSPERDAY = 86164;
    }

    public static class SimulationConstants
    {
        public const double Altitude_Meters = 1200000;
        public const double Inclination = 57 / 180.0 * Math.PI;
    }


    //-------------------------------------------------------------------------------------
    /// <summary>
    /// 
    /// </summary>
    //-------------------------------------------------------------------------------------
    public class MainModel : BaseModel, IDisposable
    {
        double beamDivergence = 50 / 180.0 * Math.PI;
        public double GlobalTimeSeconds { get; set; }
        public double StartTimeSeconds { get; set; }
        int _heatmapWidth = 400;
        int _heatmapHeight = 200;
        bool _running = true;
        Thread _heatMapThread;
        IChartPlotter _chartPlotter;
        

        public Heatmap _heatMap {get; set;}

        /// <summary>
        /// Obervable property: VisualObjects
        /// </summary>
        public ObservableCollection<SatelliteModel> Satellites { get; set; }

        /// <summary>
        /// Obervable property: WindowTitle
        /// </summary>
        public string WindowTitle
        {
            get { return "SkyNet v" + Assembly.GetExecutingAssembly().GetName().Version; }
        }

        /// <summary>
        /// Obervable property: FieldOfView
        /// </summary>
        private double _fieldOfView;
        public double FieldOfView
        {
            get { return _fieldOfView; }
            set
            {
                _fieldOfView = ((int)(value * 100))/100.0;
                RaisePropertyChanged("FieldOfView");
            }
        }
        
        /// <summary>
        /// Obervable property: Scale
        /// </summary>
        private double _scale;
        public double Scale
        {
            get { return _scale; }
            set
            {
                _scale = value;
                RaisePropertyChanged("Scale");
            }
        }


        /// <summary>
        /// Obervable property: CenterX
        /// </summary>
        private double _centerX;
        public double CenterX
        {
            get { return _centerX; }
            set
            {
                _centerX = value;
                RaisePropertyChanged("CenterX");
            }
        }


        /// <summary>
        /// Obervable property: CenterY
        /// </summary>
        private double _centerY;
        public double CenterY
        {
            get { return _centerY; }
            set
            {
                _centerY = value;
                RaisePropertyChanged("CenterY");
            }
        }


        /// <summary>
        /// Obervable property: TimeDilation
        /// </summary>
        private int _timeDilation;
        public int TimeDilation
        {
            get { return _timeDilation; }
            set
            {
                _timeDilation = value;
                RaisePropertyChanged("TimeDilation");
            }
        }


        /// <summary>
        /// Obervable property: PrimeCoverage
        /// </summary>
        private int _primeCoverage;
        public int PrimeCoverage
        {
            get { return _primeCoverage; }
            set
            {
                _primeCoverage = value;
                RaisePropertyChanged("PrimeCoverage");
            }
        }
        
        /// <summary>
        /// Obervable property: HeatmapEnabled
        /// </summary>
        private bool _heatmapEnabled;
        public bool HeatmapEnabled
        {
            get { return _heatmapEnabled; }
            set
            {
                _heatmapEnabled = value;
                RaisePropertyChanged("HeatmapEnabled");
            }
        }


        /// <summary>
        /// Obervable property: SatelliteCount
        /// </summary>
        private int _satelliteCount;
        public int SatelliteCount
        {
            get { return _satelliteCount; }
            set
            {
                _satelliteCount = value;
                RaisePropertyChanged("SatelliteCount");
            }
        }

        /// <summary>
        /// Obervable property: SelectedGenerator
        /// </summary>
        private SatelliteGenerationBase _selectedGenerator;
        public SatelliteGenerationBase SelectedGenerator
        {
            get { return _selectedGenerator; }
            set
            {
                _selectedGenerator = value;
                RaisePropertyChanged("SelectedGenerator");
            }
        }


        /// <summary>
        /// Obervable property: MeasurementLatitude
        /// </summary>
        private double _measurementLatitude;
        public double MeasurementLatitude
        {
            get { return _measurementLatitude; }
            set
            {
                _measurementLatitude = value;
                RaisePropertyChanged("MeasurementLatitude");
            }
        }


        /// <summary>
        /// Obervable property: EarthRotationDegrees
        /// </summary>
        private double _earthRotationDegrees;
        public double EarthRotationDegrees
        {
            get
            { 
                return GlobalTimeSeconds / PhysicalConstants.SECONDSPERDAY * 360; 
            }
        }
        

        /// <summary>
        /// Obervable property: MeasurementLongitude
        /// </summary>
        private double _measurementLongitude;
        public double MeasurementLongitude
        {
            get { return _measurementLongitude; }
            set
            {
                _measurementLongitude = value;
                RaisePropertyChanged("MeasurementLongitude");
            }
        }


        /// <summary>
        /// Obervable property: SamplingIntervalSeconds
        /// </summary>
        private int _samplingIntervalSeconds;
        public int SamplingIntervalSeconds
        {
            get { return _samplingIntervalSeconds; }
            set
            {
                _samplingIntervalSeconds = value;
                RaisePropertyChanged("SamplingIntervalSeconds");
            }
        }


        /// <summary>
        /// Obervable property: Samples
        /// </summary>
        private List<double> _samples;
        public List<double> Samples
        {
            get { return _samples; }
            set
            {
                _samples = value;
                RaisePropertyChanged("Samples");
            }
        }
        
        public SatelliteGenerationBase[] SatelliteGenerators { get; set; }

        //-------------------------------------------------------------------------------------
        /// <summary>
        /// Constructor
        /// </summary>
        //-------------------------------------------------------------------------------------
        public MainModel(IChartPlotter plotter)
        {
            _chartPlotter = plotter;

            _heatMap = new Heatmap(_heatmapWidth, _heatmapHeight, 0);
            _heatMap.Render();
            _heatMapThread = new Thread(HeatMapWorker);
            _heatMapThread.Start();

            // New York City
            MeasurementLatitude = 40.728053;
            MeasurementLongitude = -73.996552;
            SamplingIntervalSeconds = 300;

            SatelliteGenerators = new SatelliteGenerationBase[]
            {
                new SatelliteGeneratorEvenlySpaced(),
                new SatelliteGeneratorRandom()
            };

            _selectedGenerator = SatelliteGenerators[0];

            Satellites = new ObservableCollection<SatelliteModel>();
            HeatmapEnabled = false;
            PrimeCoverage = 10;

            Scale = .00001;
            CenterX = 350;
            CenterY = 150;
            TimeDilation = 10;
            FieldOfView = 10;

            SatelliteCount = 300;
            RegenerateSatellites();
        }

        double _lastSample = 0;

        //-------------------------------------------------------------------------------------
        /// <summary>
        /// RegenerateSatellites
        /// </summary>
        //-------------------------------------------------------------------------------------
        public void RegenerateSatellites()
        {
            StartTimeSeconds = GlobalTimeSeconds;
            _samples = new List<double>();
            _lastSample = GlobalTimeSeconds;
            Satellites.Clear();
            foreach(var satellite in _selectedGenerator.Generate(SatelliteCount))
            {
                Satellites.Add(satellite);
            }
        }

        //-------------------------------------------------------------------------------------
        /// <summary>
        /// Move
        /// </summary>
        //-------------------------------------------------------------------------------------
        internal void Move(double timeStep)
        {
            timeStep *= TimeDilation;
            GlobalTimeSeconds += timeStep;
            foreach (var satellite in Satellites)
            {
                for (int i = 0; i < 20; i++)
                {
                    satellite.Move(timeStep/20);
                }

            }
        }

        int _heatmapRenderIndex = 0;
        double newHeatMapBudget = 0;
        void HeatMapWorker(object state)
        {
            while(_running)
            {
                if (newHeatMapBudget <= 0 || !HeatmapEnabled || Satellites.Count == 0)
                {
                    Thread.Sleep(1);
                    continue;
                }

                var coveragePerSatellite = .85 / PrimeCoverage ;
                var coverageRadius = (int)(20 * _heatmapWidth / 400.0);
                var millisecondBudget = newHeatMapBudget;
                newHeatMapBudget = 0;

                Action heatmapRender = ()=>
                    {
                        if (GlobalTimeSeconds - _lastSample > SamplingIntervalSeconds)
                        {
                            var shift = EarthRotationDegrees / 360 * _heatMap.Width;
                            double x = (_heatMap.Width / 2 + _heatMap.Width / 2 * MeasurementLongitude / 180 + shift) % _heatMap.Width;
                            double y = _heatMap.Height / 2 - _heatMap.Height / 2 * MeasurementLatitude / 90;
                            //_heatMap.DrawSpot(x, y, 3, 1);
                            var measurement = _heatMap.GetValue(x, y) * PrimeCoverage;
                            var lastSampleHours = (GlobalTimeSeconds - StartTimeSeconds)/3600.0;
                            _chartPlotter.AddPoint(lastSampleHours, measurement);
                        }
                        _heatMap.Render();
                        _heatMap.Clear();
                    };

                var stopwatch = new Stopwatch();
                stopwatch.Start();
                while(stopwatch.Elapsed.TotalMilliseconds < millisecondBudget && _running)
                {
                    if(_heatmapRenderIndex >= Satellites.Count)
                    {
                        _heatmapRenderIndex = 0;
                        Dispatcher.Invoke(heatmapRender, null);
                    }
                    var location = Satellites[_heatmapRenderIndex++].Location;

                    // Back out the correct mapping of this satellite onto the heatmap
                    var h = Math.Sqrt(location.X * location.X + location.Z * location.Z);
                    var sinTheta = -location.Z / h;
                    var theta = -Math.Asin(sinTheta);
                    if (h == 0) theta = Math.PI / 2;
                    if (location.X > 0) theta = Math.PI / 2 + (Math.PI / 2 - theta);
                    var h2 = location.Length;
                    var sinPhi = location.Y / h2;
                    var phi = Math.Asin(sinPhi);
                    if (h2 == 0) phi = Math.PI / 2;

                    var heatx = (theta - Math.PI) / (Math.PI * 2) * _heatmapWidth;
                    var heaty = (Math.PI / 2 - phi) / Math.PI * _heatmapHeight;

                    _heatMap.DrawSpot(heatx, heaty, coverageRadius, coveragePerSatellite);
                }

               
            }
        }

        internal void RenderToHeatMap(double millisecondBudget)
        {
            newHeatMapBudget = millisecondBudget;
        }

        public void Dispose()
        {
            _running = false;
            _heatMapThread.Join();

        }

        public System.Windows.Threading.Dispatcher Dispatcher { get; set; }

        public object CurrentSatelliteConfigLabel { get { return _selectedGenerator.ToString(); } }
    }

}

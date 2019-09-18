using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Media;
using System.Windows.Media.Imaging;

namespace SkyNet
{
    //-------------------------------------------------------------------------------------
    /// <summary>
    /// Heatmap - Provides ability to render heatmap textures
    /// </summary>
    //-------------------------------------------------------------------------------------
    public class Heatmap
    {
        WriteableBitmap _heatMap;
        public ImageSource Bitmap { get { return _heatMap; } }
        int[] _heatMapPixels;
        double[] _heatMapValues;
        public int Width { get; private set; }
        public int Height { get; private set; }
        public double Transparency { get; set; }
        int[] palette = new int[256];

        double[] _radiusMapAdjust;

        //-------------------------------------------------------------------------------------
        /// <summary>
        /// Constructor
        /// </summary>
        //-------------------------------------------------------------------------------------
        public Heatmap(int width, int height, double transparency = 0)
        {
            Width = width;
            Height = height;
            Transparency = transparency;

            InitializeBuffers();
            PrecomputeScalingFactors();
            InitializePalette();
        }

        //-------------------------------------------------------------------------------------
        /// <summary>
        /// InitializeBuffers
        /// </summary>
        //-------------------------------------------------------------------------------------
        private void InitializeBuffers()
        {
            _heatMap = new WriteableBitmap(Width, Height, Width, Height, PixelFormats.Bgra32, null);
            _heatMapPixels = new int[Width * Height];
            _heatMapValues = new double[Width * Height];
        }

        //-------------------------------------------------------------------------------------
        /// <summary>
        /// PrecomputeScalingFactors- Since this is a cylindrical projection, we have to 
        /// scale for latitude
        /// </summary>
        //-------------------------------------------------------------------------------------
        private void PrecomputeScalingFactors()
        {
            // Setup up line-by-line scaling values to account for high latitude curvature
            _radiusMapAdjust = new double[Height];
            for (int i = 0; i < Height; i++)
            {
                var theta = ((double)i - Height / 2) / (Height / 2) * Math.PI / 2;
                var cos = Math.Cos(theta);
                var radiusScaleFactor = double.MaxValue;
                if (cos != 0.0) radiusScaleFactor = 1 / Math.Cos(theta);

                // To save on computation, limit the scalign at high latitudes this 
                // will be "close enough" for our puposes
                if (radiusScaleFactor > 2.5) radiusScaleFactor = 2.5;
                _radiusMapAdjust[i] = radiusScaleFactor;
            }
        }

        //-------------------------------------------------------------------------------------
        /// <summary>
        /// InitializePalette- Colors for visualizing coverage
        /// </summary>
        //-------------------------------------------------------------------------------------
        private void InitializePalette()
        {
            // set up the color palette
            ulong baseColor = (ulong)(0x6f) << 24;
            var newPalette = new List<int>();
            newPalette.Add((int)(baseColor));


            for (ulong i = 1; i <= 50; i++)
            {
                ulong red = 255;
                ulong green = i * 3;
                newPalette.Add((int)(baseColor + (red << 16) + (green << 8)));
            }
            for (ulong i = 1; i <= 50; i++)
            {
                ulong red = 255;
                ulong green = 150 + i * 2;
                newPalette.Add((int)(baseColor + (red << 16) + (green << 8)));
            }
            for (ulong i = 1; i <= 50; i++)
            {
                ulong red = 255 - i * 5;
                ulong green = 255;
                newPalette.Add((int)(baseColor + (red << 16) + (green << 8)));
            }
            for (ulong i = 1; i <= 25; i++)
            {
                ulong red = i * 10;
                ulong blue = i * 10;
                ulong green = 255;
                newPalette.Add((int)(baseColor + (red << 16) + (green << 8) + blue));
            }
            palette = newPalette.ToArray();
        }

        //-------------------------------------------------------------------------------------
        /// <summary>
        /// Render - render heatmap data as colors to the texture map
        /// </summary>
        //-------------------------------------------------------------------------------------
        public void Render()
        {
            int maxColor = palette.Length - 1;
            for (int i = 0; i < _heatMapValues.Length; i++)
            {
                int byteValue = (int)(maxColor * _heatMapValues[i]);
                if (byteValue > maxColor) byteValue = maxColor;
                _heatMapPixels[i] = palette[byteValue];
            }
            var stride = Width * _heatMap.Format.BitsPerPixel / 8;
            _heatMap.WritePixels(new Int32Rect(0, 0, Width, Height), _heatMapPixels, stride, 0);
        }

        //-------------------------------------------------------------------------------------
        /// <summary>
        /// Clear
        /// </summary>
        //-------------------------------------------------------------------------------------
        public void Clear()
        {
            for (int i = 0; i < _heatMapValues.Length; i++)
            {
                _heatMapValues[i] = 0;
            }
        }

        //-------------------------------------------------------------------------------------
        /// <summary>
        /// Get the heatmap value for a particular point
        /// </summary>
        //-------------------------------------------------------------------------------------
        public double GetValue(double x, double y)
        {
            var xx = (int)(x % Width);
            var yy = (int)(y % Height);
            return _heatMapValues[xx + yy * Width];
        }

        //-------------------------------------------------------------------------------------
        /// <summary>
        /// DrawSpot - Draw a circular spot on the heat map
        /// </summary>
        //-------------------------------------------------------------------------------------
        public void DrawSpot(double x, double y, int radius, double strength)
        {
            var xoff = x - (int)x;
            var yoff = y - (int)y;
            var r2 = radius * radius;
            for (int dy = -radius; dy <= radius; dy++)
            {
                var yy = y + dy;
                if (yy < 0 || yy >= Height) continue;

                var radiusScaleFactor = _radiusMapAdjust[(int)yy];

                var radiusTrim = Math.Sqrt(r2 - dy * dy) / radius;
                var adjustedRadius = (int)(radius * radiusScaleFactor * radiusTrim);

                var startx = (int)(x - adjustedRadius);
                startx = (startx + Width) % Width;
                var index = (int)startx + (int)yy * Width;
                var span = adjustedRadius * 2;

                for (int i = 0; i < span; i++)
                {
                    _heatMapValues[index] += strength;
                    index++;
                }
            }
        }
    }
}

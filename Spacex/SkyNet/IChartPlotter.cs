using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace SkyNet
{
    public interface IChartPlotter
    {
        void AddPoint(double hours, double coverage);
    }
}

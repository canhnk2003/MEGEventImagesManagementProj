using static System.Net.Mime.MediaTypeNames;
using System.ComponentModel.DataAnnotations.Schema;
using System.ComponentModel.DataAnnotations;

namespace MEGEventImageManagement.Model
{
    public class Event
    {
        [Key]
        [Column(TypeName = "nvarchar(50)")]
        public string Id { get; set; }

        [Required]
        [MaxLength(255)]
        public string Name { get; set; }

        [MaxLength(500)]
        public string Description { get; set; }

        [Required]
        public DateTime TimeOccurs { get; set; }

        public int Status { get; set; }

        // Navigation property
        public ICollection<Image>? Images { get; set; }
    }
}
